/**
 * Unified Payment Service
 * Routes payment operations to the appropriate provider based on configuration
 */

import { 
  PaymentProvider, 
  PaymentRequest, 
  PaymentResponse, 
  PaymentStatusResponse, 
  WebhookCallback, 
  BalanceResponse,
  PaymentProviderType,
  BatchPaymentRequest,
  BatchPaymentResponse,
} from './types';
import { createJengaProvider } from './jenga-provider';
import { createSafaricomProvider } from './safaricom-provider';
import { createCoopProvider } from './coop-provider';

type ProviderInstance = PaymentProvider;

export class UnifiedPaymentService {
  private providers: Map<PaymentProviderType, ProviderInstance> = new Map();
  private defaultProvider: PaymentProviderType;

  constructor() {
    this.initializeProviders();
    this.defaultProvider = this.determineDefaultProvider();
  }

  private initializeProviders(): void {
    // Initialize all available providers
    const jengaProvider = createJengaProvider();
    const safaricomProvider = createSafaricomProvider();
    const coopProvider = createCoopProvider();

    if (jengaProvider.config.enabled) {
      this.providers.set('jenga', jengaProvider);
    }

    if (safaricomProvider.config.enabled) {
      this.providers.set('safaricom', safaricomProvider);
    }

    if (coopProvider.config.enabled) {
      this.providers.set('coop', coopProvider);
    }

    console.log(`💳 Payment providers initialized: ${Array.from(this.providers.keys()).join(', ')}`);
  }

  private determineDefaultProvider(): PaymentProviderType {
    // Priority order: Safaricom (direct M-Pesa) > Jenga > COOP
    if (this.providers.has('safaricom')) return 'safaricom';
    if (this.providers.has('jenga')) return 'jenga';
    if (this.providers.has('coop')) return 'coop';
    
    throw new Error('No payment providers are configured and enabled');
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): PaymentProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider instance
   */
  getProvider(providerType?: PaymentProviderType): ProviderInstance {
    const provider = providerType || this.defaultProvider;
    const instance = this.providers.get(provider);
    
    if (!instance) {
      throw new Error(`Payment provider '${provider}' is not available or not configured`);
    }
    
    return instance;
  }

  /**
   * Send STK Push using specified or default provider
   */
  async sendStkPush(
    request: PaymentRequest, 
    providerType?: PaymentProviderType
  ): Promise<PaymentResponse & { providerUsed: PaymentProviderType }> {
    // If no provider specified, find the best one for STK Push
    let provider = providerType;
    
    if (!provider) {
      // Find first provider that supports STK Push
      const availableTypes = Array.from(this.providers.keys());
      for (const type of availableTypes) {
        const instance = this.providers.get(type)!;
        if (instance.capabilities.stkPush) {
          provider = type;
          break;
        }
      }
      
      if (!provider) {
        throw new Error('No provider supports STK Push functionality');
      }
    }

    const instance = this.getProvider(provider);
    
    if (!instance.capabilities.stkPush) {
      throw new Error(`Provider '${provider}' does not support STK Push`);
    }

    console.log(`📱 Sending STK Push via ${provider}:`, {
      phone: request.phoneNumber,
      amount: request.amount,
      reference: request.reference,
    });

    const response = await instance.sendStkPush(request);
    
    return {
      ...response,
      providerUsed: provider,
    };
  }

  /**
   * Get payment status from specified provider
   */
  async getPaymentStatus(
    transactionId: string, 
    providerType: PaymentProviderType
  ): Promise<PaymentStatusResponse> {
    const provider = this.getProvider(providerType);
    return await provider.getPaymentStatus(transactionId);
  }

  /**
   * Process webhook callback from specified provider
   */
  async processWebhookCallback(
    data: any, 
    providerType: PaymentProviderType
  ): Promise<WebhookCallback> {
    const provider = this.getProvider(providerType);
    
    // Verify callback first
    const isValid = await provider.verifyWebhookCallback(data);
    if (!isValid) {
      throw new Error(`Invalid webhook callback from ${providerType}`);
    }

    console.log(`🔄 Processing webhook from ${providerType}:`, data);
    
    return await provider.processWebhookCallback(data);
  }

  /**
   * Get account balance from specified provider
   */
  async getBalance(
    providerType?: PaymentProviderType, 
    accountNumber?: string
  ): Promise<BalanceResponse> {
    const provider = this.getProvider(providerType);
    
    if (!provider.capabilities.balance) {
      throw new Error(`Provider '${providerType || this.defaultProvider}' does not support balance inquiry`);
    }

    return await provider.getBalance(accountNumber);
  }

  /**
   * Check health status of all providers
   */
  async checkAllProvidersHealth(): Promise<Record<PaymentProviderType, boolean>> {
    const healthStatus: Partial<Record<PaymentProviderType, boolean>> = {};
    
    const healthChecks = Array.from(this.providers.keys()).map(async (type) => {
      try {
        const provider = this.providers.get(type)!;
        const isHealthy = await provider.healthCheck();
        healthStatus[type] = isHealthy;
        console.log(`🏥 Provider ${type} health: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      } catch (error) {
        console.error(`❌ Provider ${type} health check failed:`, error);
        healthStatus[type] = false;
      }
    });

    await Promise.allSettled(healthChecks);
    
    return healthStatus as Record<PaymentProviderType, boolean>;
  }

  /**
   * Process batch payments with automatic provider selection
   */
  async processBatchPayments(request: BatchPaymentRequest): Promise<BatchPaymentResponse> {
    const startTime = Date.now();
    
    // Group payments by optimal provider
    const providerGroups = this.groupPaymentsByProvider(request.payments);
    
    console.log(`📦 Processing batch of ${request.payments.length} payments across providers:`, 
      Object.keys(providerGroups));

    const allResults: PaymentResponse[] = [];
    let successfulPayments = 0;
    let failedPayments = 0;
    let pendingPayments = 0;

    // Process each provider group
    for (const providerTypeKey in providerGroups) {
      const providerType = providerTypeKey as PaymentProviderType;
      const payments = providerGroups[providerTypeKey];
      try {
        const provider = this.getProvider(providerType as PaymentProviderType);
        
        if (!provider.capabilities.batch_processing) {
          // Process individually if batch processing not supported
          for (const payment of payments) {
            const result = await provider.sendStkPush(payment);
            allResults.push(result);
            this.updateCounters(result, { successfulPayments, failedPayments, pendingPayments });
          }
        } else {
          // Use provider's batch processing
          const batchResults = await provider.processBatchPayments!(payments);
          allResults.push(...batchResults);
          
          batchResults.forEach(result => {
            this.updateCounters(result, { successfulPayments, failedPayments, pendingPayments });
          });
        }
      } catch (error) {
        console.error(`❌ Batch processing failed for provider ${providerType}:`, error);
        
        // Mark all payments in this group as failed
        payments.forEach(payment => {
          allResults.push({
            success: false,
            transactionId: '',
            reference: payment.reference,
            status: 'failed',
            message: `Provider ${providerType} batch processing failed`,
          });
          failedPayments++;
        });
      }
    }

    const batchResponse: BatchPaymentResponse = {
      batchId: `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      totalPayments: request.payments.length,
      successfulPayments,
      failedPayments,
      pendingPayments,
      results: allResults,
      completedAt: new Date(),
    };

    console.log(`✅ Batch processing completed in ${Date.now() - startTime}ms:`, {
      total: batchResponse.totalPayments,
      successful: batchResponse.successfulPayments,
      failed: batchResponse.failedPayments,
      pending: batchResponse.pendingPayments,
    });

    return batchResponse;
  }

  /**
   * Get best provider for specific payment type
   */
  getBestProviderForPayment(paymentType: 'stk_push' | 'b2c' | 'b2b'): PaymentProviderType {
    const preferences = {
      stk_push: ['safaricom', 'jenga', 'coop'] as PaymentProviderType[],
      b2c: ['jenga', 'safaricom', 'coop'] as PaymentProviderType[],
      b2b: ['coop', 'jenga', 'safaricom'] as PaymentProviderType[],
    };

    for (const providerType of preferences[paymentType]) {
      const provider = this.providers.get(providerType);
      if (provider) {
        const capability = paymentType === 'stk_push' ? provider.capabilities.stkPush :
                         paymentType === 'b2c' ? provider.capabilities.b2c :
                         provider.capabilities.b2b;
        
        if (capability) {
          return providerType;
        }
      }
    }

    throw new Error(`No provider available for ${paymentType}`);
  }

  private groupPaymentsByProvider(payments: PaymentRequest[]): Record<string, PaymentRequest[]> {
    const groups: Record<string, PaymentRequest[]> = {};

    payments.forEach(payment => {
      // For now, use default provider for all payments
      // Could implement smarter routing based on amount, phone number, etc.
      const provider = this.defaultProvider;
      
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(payment);
    });

    return groups;
  }

  private updateCounters(
    result: PaymentResponse, 
    counters: { successfulPayments: number; failedPayments: number; pendingPayments: number }
  ): void {
    if (result.success && (result.status === 'completed' || result.status === 'processing')) {
      if (result.status === 'completed') {
        counters.successfulPayments++;
      } else {
        counters.pendingPayments++;
      }
    } else {
      counters.failedPayments++;
    }
  }
}

// Singleton instance
let unifiedPaymentService: UnifiedPaymentService | null = null;

/**
 * Get the unified payment service instance
 */
export function getUnifiedPaymentService(): UnifiedPaymentService {
  if (!unifiedPaymentService) {
    unifiedPaymentService = new UnifiedPaymentService();
  }
  return unifiedPaymentService;
}

/**
 * Reinitialize the payment service (useful after configuration changes)
 */
export function reinitializePaymentService(): UnifiedPaymentService {
  unifiedPaymentService = new UnifiedPaymentService();
  return unifiedPaymentService;
}