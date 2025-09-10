/**
 * SAFARICOM Payment Provider
 * Direct M-Pesa integration using Safaricom API
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
import crypto from 'crypto';

interface SafaricomTokenResponse {
  access_token: string;
  expires_in: string;
}

interface SafaricomSTKResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

interface SafaricomCallbackData {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

export class SafaricomPaymentProvider implements PaymentProvider {
  public readonly providerType = 'safaricom' as const;
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

  private accessToken: string = '';
  private tokenExpiry: Date = new Date();

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async sendStkPush(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      await this.ensureValidToken();
      
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(
        `${this.config.shortCode}${this.config.passkey}${timestamp}`
      ).toString('base64');

      const payload = {
        BusinessShortCode: this.config.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: parseInt(request.amount),
        PartyA: this.formatPhoneNumber(request.phoneNumber),
        PartyB: this.config.shortCode,
        PhoneNumber: this.formatPhoneNumber(request.phoneNumber),
        CallBackURL: this.config.callbackUrl,
        AccountReference: request.accountReference || request.reference,
        TransactionDesc: request.transactionDesc || request.description,
      };

      const response = await fetch(`${this.config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: SafaricomSTKResponse = await response.json();

      if (response.ok && data.ResponseCode === '0') {
        return {
          success: true,
          transactionId: data.CheckoutRequestID,
          reference: request.reference,
          status: 'processing',
          message: data.CustomerMessage,
          checkoutRequestId: data.CheckoutRequestID,
          merchantRequestId: data.MerchantRequestID,
          providerData: {
            merchantRequestId: data.MerchantRequestID,
            checkoutRequestId: data.CheckoutRequestID,
            responseCode: data.ResponseCode,
            responseDescription: data.ResponseDescription,
          },
        };
      } else {
        throw new Error(data.ResponseDescription || 'STK Push failed');
      }
    } catch (error: any) {
      console.error('Safaricom STK Push failed:', error);
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
      await this.ensureValidToken();
      
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(
        `${this.config.shortCode}${this.config.passkey}${timestamp}`
      ).toString('base64');

      const payload = {
        BusinessShortCode: this.config.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: transactionId,
      };

      const response = await fetch(`${this.config.baseUrl}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      return {
        transactionId,
        reference: data.AccountReference || '',
        status: this.mapSafaricomStatus(data.ResultCode),
        amount: data.Amount?.toString(),
        phoneNumber: data.PhoneNumber,
        completedAt: data.TransactionDate ? new Date(data.TransactionDate) : undefined,
        failureReason: data.ResultDesc,
        providerData: data,
      };
    } catch (error: any) {
      console.error('Safaricom status check failed:', error);
      return {
        transactionId,
        reference: '',
        status: 'failed',
        failureReason: error.message,
      };
    }
  }

  async verifyWebhookCallback(data: any): Promise<boolean> {
    // Safaricom doesn't provide signature verification
    // We can validate the structure and required fields
    try {
      const callback = data as SafaricomCallbackData;
      return !!(
        callback.Body?.stkCallback?.MerchantRequestID &&
        callback.Body?.stkCallback?.CheckoutRequestID &&
        typeof callback.Body?.stkCallback?.ResultCode === 'number'
      );
    } catch (error) {
      console.error('Safaricom webhook verification failed:', error);
      return false;
    }
  }

  async processWebhookCallback(data: any): Promise<WebhookCallback> {
    const callback = data as SafaricomCallbackData;
    const stkCallback = callback.Body.stkCallback;
    
    let receiptNumber = '';
    let phoneNumber = '';
    let amount = '';
    
    if (stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'MpesaReceiptNumber':
            receiptNumber = item.Value.toString();
            break;
          case 'PhoneNumber':
            phoneNumber = item.Value.toString();
            break;
          case 'Amount':
            amount = item.Value.toString();
            break;
        }
      }
    }

    return {
      transactionId: stkCallback.CheckoutRequestID,
      reference: stkCallback.MerchantRequestID,
      status: this.mapSafaricomStatus(stkCallback.ResultCode),
      amount,
      phoneNumber,
      receiptNumber,
      completedAt: new Date().toISOString(),
      failureReason: stkCallback.ResultCode !== 0 ? stkCallback.ResultDesc : undefined,
      providerType: 'safaricom',
      providerData: stkCallback,
    };
  }

  async getBalance(accountNumber?: string): Promise<BalanceResponse> {
    try {
      await this.ensureValidToken();
      
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const securityCredential = this.generateSecurityCredential();

      const payload = {
        Initiator: this.config.initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'AccountBalance',
        PartyA: this.config.shortCode,
        IdentifierType: '4',
        Remarks: 'Account balance inquiry',
        QueueTimeOutURL: `${this.config.callbackUrl}/timeout`,
        ResultURL: `${this.config.callbackUrl}/result`,
      };

      const response = await fetch(`${this.config.baseUrl}/mpesa/accountbalance/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Note: Safaricom balance API is asynchronous, returns via callback
      // For immediate response, we return a placeholder
      return {
        accountNumber: this.config.shortCode || '',
        currency: 'KES',
        available: '0.00', // Will be updated via callback
        actual: '0.00',
        providerType: 'safaricom',
        lastUpdated: new Date(),
      };
    } catch (error: any) {
      console.error('Safaricom balance check failed:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      return !!this.accessToken;
    } catch (error) {
      console.error('Safaricom health check failed:', error);
      return false;
    }
  }

  async processBatchPayments(payments: PaymentRequest[]): Promise<PaymentResponse[]> {
    const results: PaymentResponse[] = [];
    
    // Process payments in smaller batches to respect Safaricom rate limits
    const batchSize = 3;
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
        
        // Add longer delay between batches for Safaricom
        if (i + batchSize < payments.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error: any) {
        console.error('Batch processing error:', error);
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

  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && new Date() < this.tokenExpiry) {
      return;
    }

    await this.getAccessToken();
  }

  private async getAccessToken(): Promise<void> {
    const auth = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64');

    const response = await fetch(`${this.config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get Safaricom access token');
    }

    const data: SafaricomTokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (parseInt(data.expires_in) * 1000) - 60000);
  }

  private formatPhoneNumber(phone: string): string {
    // Convert to international format for Kenya
    let formatted = phone.replace(/\D/g, '');
    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.substring(1);
    } else if (!formatted.startsWith('254')) {
      formatted = '254' + formatted;
    }
    return formatted;
  }

  private generateSecurityCredential(): string {
    // In production, this should encrypt the initiator password with Safaricom's public key
    // For sandbox, return the plain password
    return this.config.securityCredential || '';
  }

  private mapSafaricomStatus(resultCode: number): PaymentStatus {
    switch (resultCode) {
      case 0:
        return 'completed';
      case 1032:
        return 'cancelled'; // User cancelled
      case 1037:
        return 'failed'; // Timeout
      case 1:
        return 'failed'; // Insufficient funds
      case 2001:
        return 'failed'; // Invalid parameters
      default:
        return resultCode === undefined ? 'processing' : 'failed';
    }
  }
}

// Factory function to create Safaricom provider
export function createSafaricomProvider(): SafaricomPaymentProvider {
  const config: ProviderConfig = {
    enabled: !!(process.env.SAFARICOM_CONSUMER_KEY && process.env.SAFARICOM_CONSUMER_SECRET),
    sandbox: process.env.NODE_ENV !== 'production',
    baseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke',
    apiKey: '', // Not used for Safaricom
    consumerKey: process.env.SAFARICOM_CONSUMER_KEY || '',
    consumerSecret: process.env.SAFARICOM_CONSUMER_SECRET || '',
    shortCode: process.env.SAFARICOM_SHORT_CODE || '',
    passkey: process.env.SAFARICOM_PASSKEY || '',
    initiatorName: process.env.SAFARICOM_INITIATOR_NAME || '',
    securityCredential: process.env.SAFARICOM_SECURITY_CREDENTIAL || '',
    callbackUrl: process.env.SAFARICOM_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/safaricom`,
    timeout: 30000,
  };

  return new SafaricomPaymentProvider(config);
}

// Async factory function with validated configuration
export async function createValidatedSafaricomProvider(): Promise<SafaricomPaymentProvider> {
  const { getProviderConfig } = await import('./provider-config');
  const validatedConfig = await getProviderConfig('safaricom');
  return new SafaricomPaymentProvider(validatedConfig);
}