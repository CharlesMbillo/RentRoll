/**
 * JENGA Payment Provider
 * Handles M-Pesa STK Push through JengaAPI
 */

import { 
  PaymentProvider, 
  PaymentRequest, 
  PaymentResponse, 
  PaymentStatusResponse, 
  WebhookCallback, 
  BalanceResponse,
  ProviderConfig,
  ProviderCapabilities,
  PaymentStatus
} from './types';
import { createJengaApiClient } from '../jengaApi';

export class JengaPaymentProvider implements PaymentProvider {
  public readonly providerType = 'jenga' as const;
  public readonly config: ProviderConfig;
  public readonly capabilities: ProviderCapabilities = {
    stkPush: true,
    b2c: true,
    b2b: true,
    balance: true,
    reversal: true,
    webhook: true,
    csv_reconciliation: false,
    batch_processing: true,
  };

  private jengaClient: ReturnType<typeof createJengaApiClient>;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.jengaClient = createJengaApiClient();
  }

  async sendStkPush(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const jengaResponse = await this.jengaClient.sendMpesaSTKPush(
        request.phoneNumber,
        request.amount,
        request.reference,
        request.description
      );

      return {
        success: jengaResponse.status === 'SUCCESS' || jengaResponse.status === 'PENDING',
        transactionId: jengaResponse.transactionId,
        reference: request.reference,
        status: this.mapJengaStatus(jengaResponse.status),
        message: jengaResponse.message,
        providerData: {
          jengaTransactionId: jengaResponse.transactionId,
          jengaStatus: jengaResponse.status,
          jengaMessage: jengaResponse.message,
        },
      };
    } catch (error: any) {
      console.error('Jenga STK Push failed:', error);
      return {
        success: false,
        transactionId: '',
        reference: request.reference,
        status: 'failed',
        message: error.message || 'STK Push failed',
        providerData: { error: error.message },
      };
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const statusResponse = await this.jengaClient.getPaymentStatus(transactionId);
      
      return {
        transactionId,
        reference: statusResponse.reference || '',
        status: this.mapJengaStatus(statusResponse.status),
        amount: statusResponse.amount,
        phoneNumber: statusResponse.phoneNumber,
        completedAt: statusResponse.completedAt ? new Date(statusResponse.completedAt) : undefined,
        failureReason: statusResponse.failureReason,
        providerData: statusResponse,
      };
    } catch (error: any) {
      console.error('Jenga status check failed:', error);
      return {
        transactionId,
        reference: '',
        status: 'failed',
        failureReason: error.message,
      };
    }
  }

  async verifyWebhookCallback(data: any): Promise<boolean> {
    try {
      return await this.jengaClient.verifyPaymentCallback(data);
    } catch (error) {
      console.error('Jenga webhook verification failed:', error);
      return false;
    }
  }

  async processWebhookCallback(data: any): Promise<WebhookCallback> {
    return {
      transactionId: data.transactionId || '',
      reference: data.reference || '',
      status: this.mapJengaStatus(data.status),
      amount: data.amount,
      phoneNumber: data.phoneNumber,
      receiptNumber: data.receiptNumber,
      completedAt: data.completedAt,
      failureReason: data.failureReason,
      providerType: 'jenga',
      providerData: data,
    };
  }

  async getBalance(accountNumber?: string): Promise<BalanceResponse> {
    try {
      const balanceData = await this.jengaClient.getAccountBalance(
        accountNumber || this.config.merchantCode || ''
      );

      return {
        accountNumber: balanceData.accountNumber,
        currency: balanceData.currency,
        available: balanceData.balances.available,
        actual: balanceData.balances.actual,
        providerType: 'jenga',
        lastUpdated: new Date(),
      };
    } catch (error: any) {
      console.error('Jenga balance check failed:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.jengaClient.healthCheck();
    } catch (error) {
      console.error('Jenga health check failed:', error);
      return false;
    }
  }

  async reverseTransaction(transactionId: string, amount: string, reason: string): Promise<PaymentResponse> {
    try {
      // Implement reversal logic using JengaAPI
      // Note: This requires specific reversal endpoint implementation
      // Note: JengaAPI reversal implementation would need to be added to jengaApi.ts
      // For now, return a placeholder response
      console.warn('Jenga reversal not yet implemented in JengaApiClient');
      
      return {
        success: false,
        transactionId: '',
        reference: '',
        status: 'failed',
        message: 'Reversal not implemented yet',
        providerData: { error: 'Reversal method not available in JengaApiClient' },
      };
    } catch (error: any) {
      console.error('Jenga reversal failed:', error);
      return {
        success: false,
        transactionId: '',
        reference: '',
        status: 'failed',
        message: error.message || 'Reversal failed',
        providerData: { error: error.message },
      };
    }
  }

  async processBatchPayments(payments: PaymentRequest[]): Promise<PaymentResponse[]> {
    const results: PaymentResponse[] = [];
    
    // Process payments in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < payments.length; i += batchSize) {
      const batch = payments.slice(i, i + batchSize);
      const batchPromises = batch.map(payment => this.sendStkPush(payment));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              transactionId: '',
              reference: '',
              status: 'failed',
              message: result.reason?.message || 'Batch processing failed',
            });
          }
        });
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < payments.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error('Batch processing error:', error);
        // Add failed responses for remaining items in batch
        batch.forEach(() => {
          results.push({
            success: false,
            transactionId: '',
            reference: '',
            status: 'failed',
            message: 'Batch processing failed',
          });
        });
      }
    }
    
    return results;
  }

  private mapJengaStatus(jengaStatus: string): PaymentStatus {
    switch (jengaStatus?.toUpperCase()) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'completed';
      case 'PENDING':
      case 'PROCESSING':
        return 'processing';
      case 'FAILED':
      case 'ERROR':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      case 'REFUNDED':
        return 'refunded';
      default:
        return 'pending';
    }
  }
}

// Factory function to create Jenga provider
export function createJengaProvider(): JengaPaymentProvider {
  // Load configuration with validation - will be handled asynchronously in unified service
  const hasJengaCredentials = !!(process.env.JENGA_API_KEY && process.env.JENGA_MERCHANT_CODE && process.env.JENGA_CONSUMER_SECRET);
  
  const config: ProviderConfig = {
    // Enable in development mode for testing, or when credentials are available
    enabled: process.env.NODE_ENV === 'development' || hasJengaCredentials,
    sandbox: process.env.NODE_ENV !== 'production',
    baseUrl: process.env.JENGA_BASE_URL || 'https://sandbox.jengahq.io',
    apiKey: process.env.JENGA_API_KEY || 'dev-key',
    consumerKey: process.env.JENGA_CONSUMER_KEY || 'dev-consumer-key',
    consumerSecret: process.env.JENGA_CONSUMER_SECRET || 'dev-secret',
    merchantCode: process.env.JENGA_MERCHANT_CODE || 'dev-merchant',
    callbackUrl: process.env.JENGA_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/jenga`,
    timeout: 30000,
  };

  console.log(`🔧 Jenga Provider Config: enabled=${config.enabled}, hasCredentials=${hasJengaCredentials}`);
  
  return new JengaPaymentProvider(config);
}

// Async factory function with validated configuration
export async function createValidatedJengaProvider(): Promise<JengaPaymentProvider> {
  const { getProviderConfig } = await import('./provider-config');
  const validatedConfig = await getProviderConfig('jenga');
  return new JengaPaymentProvider(validatedConfig);
}