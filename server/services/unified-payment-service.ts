/**
 * Enhanced Unified Payment Service with Improved Retry Logic
 * Implements exponential backoff and 3-5 retry attempts as per checklist requirements
 */

import { createJengaProvider } from './payment-providers/jenga-provider';
import { createSafaricomProvider } from './payment-providers/safaricom-provider';
import { createCoopProvider } from './payment-providers/coop-provider';
import type {
  PaymentRequest,
  PaymentResponse,
  BatchPaymentRequest,
  BatchPaymentResponse,
  PaymentProviderType,
  PaymentProvider,
} from './payment-providers/types';

/**
 * Retry configuration as per unified rent collection checklist
 */
export interface RetryConfig {
  maxAttempts: number; // 3-5 attempts as specified
  initialDelayMs: number; // Initial delay before first retry
  maxDelayMs: number; // Maximum delay between retries
  backoffMultiplier: number; // Exponential backoff multiplier
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5, // Maximum 5 attempts as per checklist
  initialDelayMs: 1000, // Start with 1 second delay
  maxDelayMs: 30000, // Max 30 second delay
  backoffMultiplier: 2.0, // Double the delay each retry
};

export class UnifiedPaymentService {
  private providers = new Map<PaymentProviderType, PaymentProvider>();
  private retryConfig: RetryConfig;

  constructor(retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.retryConfig = retryConfig;
    this.initializeProviders();
  }

  private initializeProviders() {
    this.providers.set('jenga', createJengaProvider());
    this.providers.set('safaricom', createSafaricomProvider());
    this.providers.set('coop', createCoopProvider());
  }

  /**
   * Send payment with enhanced retry logic
   */
  async sendPayment(request: PaymentRequest, providerId?: PaymentProviderType): Promise<PaymentResponse> {
    const selectedProvider = this.selectProvider(providerId);
    console.log(`💳 Sending payment via ${selectedProvider.providerType} with retry logic`);

    return await this.executeWithRetry(
      async () => await selectedProvider.sendStkPush(request),
      `Payment ${request.reference}`,
      request
    );
  }

  /**
   * Process batch payments with retry logic for failed individual payments
   */
  async processBatchPayments(batchRequest: BatchPaymentRequest): Promise<BatchPaymentResponse> {
    const startTime = Date.now();
    const providerId = this.getOptimalProvider();
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      throw new Error(`Provider ${providerId} not available`);
    }

    console.log(`🏢 Processing batch of ${batchRequest.payments.length} payments via ${providerId}`);

    const results: any[] = [];
    let successCount = 0;
    let failureCount = 0;
    let pendingCount = 0;

    // Process each payment with individual retry logic
    for (let i = 0; i < batchRequest.payments.length; i++) {
      const payment = batchRequest.payments[i];
      
      try {
        console.log(`📱 Processing payment ${i + 1}/${batchRequest.payments.length}: ${payment.reference}`);
        
        const result = await this.executeWithRetry(
          async () => await provider.sendStkPush(payment),
          `Batch payment ${payment.reference}`,
          payment
        );

        results.push({
          success: result.success,
          status: result.status,
          message: result.message,
          transactionId: result.transactionId,
          reference: payment.reference,
          providerData: result.providerData,
        });

        if (result.success) {
          successCount++;
        } else if (result.status === 'pending') {
          pendingCount++;
        } else {
          failureCount++;
        }

      } catch (error: any) {
        console.error(`❌ Payment ${payment.reference} failed after all retries:`, error.message);
        
        results.push({
          success: false,
          status: 'failed',
          message: error.message,
          transactionId: null,
          reference: payment.reference,
          providerData: null,
        });
        
        failureCount++;
      }

      // Add small delay between payments to avoid rate limiting
      if (i < batchRequest.payments.length - 1) {
        await this.delay(500); // 500ms between payments
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`✅ Batch processing completed in ${processingTime}ms:`, {
      total: batchRequest.payments.length,
      successful: successCount,
      failed: failureCount,
      pending: pendingCount,
    });

    return {
      batchId: `batch_${Date.now()}`,
      totalPayments: batchRequest.payments.length,
      successfulPayments: successCount,
      failedPayments: failureCount,
      pendingPayments: pendingCount,
      results,
    };
  }

  /**
   * Execute operation with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        console.log(`🔄 ${operationName} - Attempt ${attempt}/${this.retryConfig.maxAttempts}`);
        
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;

      } catch (error: any) {
        lastError = error;
        console.error(`❌ ${operationName} failed on attempt ${attempt}:`, error.message);

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.log(`🚫 ${operationName} failed with non-retryable error, stopping retries`);
          break;
        }

        // Apply exponential backoff delay
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await this.delay(delay);
        
        // Increase delay for next retry (exponential backoff)
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
      }
    }

    // All retries exhausted
    console.error(`💥 ${operationName} failed after ${this.retryConfig.maxAttempts} attempts`);
    throw lastError || new Error(`Operation failed after ${this.retryConfig.maxAttempts} attempts`);
  }

  /**
   * Determine if an error is worth retrying
   */
  private isRetryableError(error: any): boolean {
    // Network errors, timeouts, and server errors are retryable
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED', 
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'timeout',
      'network',
      'server error',
      '500',
      '502',
      '503',
      '504',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code?.toLowerCase() || '';
    
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError) || errorCode.includes(retryableError)
    );
  }

  /**
   * Smart provider selection based on availability and performance
   */
  private selectProvider(providerId?: PaymentProviderType): PaymentProvider {
    if (providerId) {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new Error(`Provider ${providerId} not available`);
      }
      return provider;
    }

    return this.getOptimalProviderInstance();
  }

  /**
   * Get the optimal provider based on current conditions
   */
  private getOptimalProvider(): PaymentProviderType {
    // Simple provider selection - can be enhanced with health checks
    // Priority: jenga > safaricom > coop
    const providerPriority: PaymentProviderType[] = ['jenga', 'safaricom', 'coop'];
    
    for (const providerId of providerPriority) {
      if (this.providers.has(providerId)) {
        return providerId;
      }
    }
    
    throw new Error('No payment providers available');
  }

  private getOptimalProviderInstance(): PaymentProvider {
    const providerId = this.getOptimalProvider();
    return this.providers.get(providerId)!;
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get provider health status
   */
  async getProviderHealthStatus() {
    const healthStatus = new Map<PaymentProviderType, any>();

    for (const [providerId, provider] of Array.from(this.providers.entries())) {
      try {
        const isHealthy = await provider.healthCheck();
        healthStatus.set(providerId, {
          healthy: isHealthy,
          capabilities: provider.capabilities,
          lastCheck: new Date().toISOString(),
        });
      } catch (error: any) {
        healthStatus.set(providerId, {
          healthy: false,
          error: error.message,
          lastCheck: new Date().toISOString(),
        });
      }
    }

    return Object.fromEntries(healthStatus);
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(newConfig: Partial<RetryConfig>) {
    this.retryConfig = { ...this.retryConfig, ...newConfig };
    console.log('🔧 Retry config updated:', this.retryConfig);
  }
}

// Singleton instance
let unifiedPaymentService: UnifiedPaymentService | null = null;

export function getUnifiedPaymentService(): UnifiedPaymentService {
  if (!unifiedPaymentService) {
    unifiedPaymentService = new UnifiedPaymentService();
  }
  return unifiedPaymentService;
}