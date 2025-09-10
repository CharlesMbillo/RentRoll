/**
 * COOP Bank Payment Provider
 * Handles bank transfers and CSV reconciliation
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
  PaymentStatus,
  ReconciliationRecord
} from './types';
import { parse } from 'csv-parse/sync';

interface CoopAPIResponse {
  transactionId: string;
  status: string;
  message: string;
  reference: string;
  accountNumber?: string;
}

export class CoopBankPaymentProvider implements PaymentProvider {
  public readonly providerType = 'coop' as const;
  public readonly config: ProviderConfig;
  public readonly capabilities: ProviderCapabilities = {
    stkPush: false, // COOP doesn't support STK Push
    b2c: true,
    b2b: true,
    balance: true,
    reversal: true,
    webhook: false, // COOP uses CSV reconciliation primarily
    csv_reconciliation: true,
    batch_processing: true,
  };

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async sendStkPush(request: PaymentRequest): Promise<PaymentResponse> {
    // COOP Bank doesn't support STK Push - this method would typically not be called
    // due to capabilities.stkPush = false, but included for interface compliance
    return {
      success: false,
      transactionId: '',
      reference: request.reference,
      status: 'failed',
      message: 'STK Push not supported by COOP Bank. Use bank transfer instead.',
      providerData: { error: 'STK Push not available' },
    };
  }

  async sendB2C(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // COOP Bank B2C implementation
      const payload = {
        accountNumber: this.config.merchantCode,
        beneficiaryAccount: request.phoneNumber, // For mobile money
        amount: request.amount,
        currency: 'KES',
        reference: request.reference,
        narration: request.description,
        callbackUrl: this.config.callbackUrl,
      };

      const response = await fetch(`${this.config.baseUrl}/api/payments/b2c`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`COOP API error: ${response.statusText}`);
      }

      const data: CoopAPIResponse = await response.json();

      return {
        success: data.status === 'SUCCESS' || data.status === 'PENDING',
        transactionId: data.transactionId,
        reference: request.reference,
        status: this.mapCoopStatus(data.status),
        message: data.message,
        providerData: {
          coopTransactionId: data.transactionId,
          coopStatus: data.status,
          accountNumber: data.accountNumber,
        },
      };
    } catch (error: any) {
      console.error('COOP B2C failed:', error);
      return {
        success: false,
        transactionId: '',
        reference: request.reference,
        status: 'failed',
        message: error.message || 'B2C transfer failed',
        providerData: { error: error.message },
      };
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/payments/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`COOP API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        transactionId,
        reference: data.reference || '',
        status: this.mapCoopStatus(data.status),
        amount: data.amount?.toString(),
        phoneNumber: data.phoneNumber,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        failureReason: data.failureReason,
        providerData: data,
      };
    } catch (error: any) {
      console.error('COOP status check failed:', error);
      return {
        transactionId,
        reference: '',
        status: 'failed',
        failureReason: error.message,
      };
    }
  }

  async verifyWebhookCallback(data: any): Promise<boolean> {
    // COOP primarily uses CSV reconciliation, limited webhook support
    try {
      return !!(data.transactionId && data.status);
    } catch (error) {
      console.error('COOP webhook verification failed:', error);
      return false;
    }
  }

  async processWebhookCallback(data: any): Promise<WebhookCallback> {
    return {
      transactionId: data.transactionId || '',
      reference: data.reference || '',
      status: this.mapCoopStatus(data.status),
      amount: data.amount,
      phoneNumber: data.phoneNumber,
      receiptNumber: data.receiptNumber,
      completedAt: data.completedAt,
      failureReason: data.failureReason,
      providerType: 'coop',
      providerData: data,
    };
  }

  async getBalance(accountNumber?: string): Promise<BalanceResponse> {
    try {
      const account = accountNumber || this.config.merchantCode;
      const response = await fetch(`${this.config.baseUrl}/api/accounts/${account}/balance`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`COOP API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        accountNumber: account || '',
        currency: data.currency || 'KES',
        available: data.availableBalance,
        actual: data.currentBalance,
        providerType: 'coop',
        lastUpdated: new Date(),
      };
    } catch (error: any) {
      console.error('COOP balance check failed:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/health`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      console.error('COOP health check failed:', error);
      return false;
    }
  }

  async processBatchPayments(payments: PaymentRequest[]): Promise<PaymentResponse[]> {
    const results: PaymentResponse[] = [];
    
    // COOP Bank typically processes larger batches
    const batchSize = 10;
    for (let i = 0; i < payments.length; i += batchSize) {
      const batch = payments.slice(i, i + batchSize);
      
      try {
        // For COOP, we'd typically use their bulk API
        const batchPayload = {
          payments: batch.map(payment => ({
            beneficiaryAccount: payment.phoneNumber,
            amount: payment.amount,
            reference: payment.reference,
            narration: payment.description,
          })),
          callbackUrl: this.config.callbackUrl,
        };

        const response = await fetch(`${this.config.baseUrl}/api/payments/bulk`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batchPayload),
        });

        const batchResult = await response.json();
        
        if (batchResult.results) {
          batchResult.results.forEach((result: any) => {
            results.push({
              success: result.status === 'SUCCESS' || result.status === 'PENDING',
              transactionId: result.transactionId,
              reference: result.reference,
              status: this.mapCoopStatus(result.status),
              message: result.message,
              providerData: result,
            });
          });
        }
        
        // Shorter delay for COOP as they handle larger batches
        if (i + batchSize < payments.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error('COOP batch processing error:', error);
        // Add failed responses for items in this batch
        batch.forEach(payment => {
          results.push({
            success: false,
            transactionId: '',
            reference: payment.reference,
            status: 'failed',
            message: 'Batch processing failed',
          });
        });
      }
    }
    
    return results;
  }

  /**
   * Process CSV reconciliation file from COOP Bank
   * This is the primary reconciliation method for COOP
   */
  async processReconciliationCSV(csvContent: string): Promise<ReconciliationRecord[]> {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const reconciliationRecords: ReconciliationRecord[] = records.map((record: any) => ({
        transactionId: record['Transaction ID'] || record['TxnId'] || '',
        reference: record['Reference'] || record['Ref'] || '',
        amount: record['Amount'] || '',
        phoneNumber: record['Phone Number'] || record['Mobile'] || '',
        status: this.mapCoopCSVStatus(record['Status'] || record['State']),
        accountNumber: record['Account Number'] || record['Account'] || '',
        narration: record['Narration'] || record['Description'] || '',
        completedAt: new Date(record['Date'] || record['Transaction Date']),
      }));

      return reconciliationRecords;
    } catch (error: any) {
      console.error('CSV reconciliation failed:', error);
      throw new Error(`Failed to process CSV: ${error.message}`);
    }
  }

  /**
   * Match reconciliation records with existing payments
   */
  async matchReconciliationRecords(
    records: ReconciliationRecord[], 
    existingPayments: any[]
  ): Promise<{ matched: number; unmatched: number; discrepancies: number }> {
    let matched = 0;
    let unmatched = 0;
    let discrepancies = 0;

    for (const record of records) {
      const payment = existingPayments.find(p => 
        p.reference === record.reference ||
        p.transactionId === record.transactionId ||
        (p.amount === record.amount && p.phoneNumber === record.phoneNumber)
      );

      if (payment) {
        // Check for discrepancies
        if (payment.amount !== record.amount) {
          discrepancies++;
        } else {
          matched++;
        }
      } else {
        unmatched++;
      }
    }

    return { matched, unmatched, discrepancies };
  }

  private mapCoopStatus(coopStatus: string): PaymentStatus {
    switch (coopStatus?.toUpperCase()) {
      case 'SUCCESS':
      case 'COMPLETED':
      case 'SUCCESSFUL':
        return 'completed';
      case 'PENDING':
      case 'PROCESSING':
        return 'processing';
      case 'FAILED':
      case 'FAILURE':
      case 'ERROR':
        return 'failed';
      case 'CANCELLED':
      case 'CANCELED':
        return 'cancelled';
      case 'REFUNDED':
        return 'refunded';
      default:
        return 'pending';
    }
  }

  private mapCoopCSVStatus(csvStatus: string): PaymentStatus {
    switch (csvStatus?.toUpperCase()) {
      case 'DR':
      case 'DEBITED':
      case 'SUCCESS':
        return 'completed';
      case 'PENDING':
        return 'processing';
      case 'FAILED':
      case 'RETURNED':
        return 'failed';
      default:
        return 'pending';
    }
  }
}

// Factory function to create COOP provider
export function createCoopProvider(): CoopBankPaymentProvider {
  const config: ProviderConfig = {
    enabled: !!process.env.COOP_API_KEY,
    sandbox: process.env.NODE_ENV !== 'production',
    baseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://api.co-opbank.co.ke' 
      : 'https://sandbox.co-opbank.co.ke',
    apiKey: process.env.COOP_API_KEY || '',
    merchantCode: process.env.COOP_MERCHANT_CODE || '',
    callbackUrl: process.env.COOP_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/coop`,
    timeout: 60000, // Longer timeout for batch operations
  };

  return new CoopBankPaymentProvider(config);
}

// Async factory function with validated configuration
export async function createValidatedCoopProvider(): Promise<CoopBankPaymentProvider> {
  const { getProviderConfig } = await import('./provider-config');
  const validatedConfig = await getProviderConfig('coop');
  return new CoopBankPaymentProvider(validatedConfig);
}