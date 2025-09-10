/**
 * Unified Payment Provider Types
 * Defines interfaces for multiple Kenyan payment providers (JENGA, SAFARICOM, COOP)
 */

export type PaymentProviderType = 'jenga' | 'safaricom' | 'coop';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export type PaymentMethod = 'mpesa' | 'bank_transfer' | 'cash' | 'check' | 'airtel_money' | 'tkash';

// Base request for initiating payments
export interface PaymentRequest {
  phoneNumber: string;
  amount: string;
  reference: string;
  description: string;
  callbackUrl?: string;
  accountReference?: string;
  transactionDesc?: string;
}

// Standardized payment response
export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  reference: string;
  status: PaymentStatus;
  message?: string;
  checkoutRequestId?: string; // For Safaricom
  merchantRequestId?: string; // For Safaricom
  providerData?: Record<string, any>; // Provider-specific data
}

// Payment status query response
export interface PaymentStatusResponse {
  transactionId: string;
  reference: string;
  status: PaymentStatus;
  amount?: string;
  phoneNumber?: string;
  completedAt?: Date;
  failureReason?: string;
  providerData?: Record<string, any>;
}

// Webhook callback data structure
export interface WebhookCallback {
  transactionId: string;
  reference: string;
  status: PaymentStatus;
  amount?: string;
  phoneNumber?: string;
  receiptNumber?: string;
  completedAt?: string;
  failureReason?: string;
  providerType: PaymentProviderType;
  providerData?: Record<string, any>;
}

// Account balance response
export interface BalanceResponse {
  accountNumber: string;
  currency: string;
  available: string;
  actual?: string;
  providerType: PaymentProviderType;
  lastUpdated: Date;
}

// Provider configuration interface
export interface ProviderConfig {
  enabled: boolean;
  sandbox: boolean;
  baseUrl: string;
  apiKey: string;
  consumerKey?: string;
  consumerSecret?: string;
  merchantCode?: string;
  passkey?: string;
  shortCode?: string;
  initiatorName?: string;
  securityCredential?: string;
  callbackUrl?: string;
  timeout?: number;
}

// Provider capabilities
export interface ProviderCapabilities {
  stkPush: boolean;
  b2c: boolean;
  b2b: boolean;
  balance: boolean;
  reversal: boolean;
  webhook: boolean;
  csv_reconciliation: boolean;
  batch_processing: boolean;
}

// Base payment provider interface
export interface PaymentProvider {
  providerType: PaymentProviderType;
  config: ProviderConfig;
  capabilities: ProviderCapabilities;

  // Core payment operations
  sendStkPush(request: PaymentRequest): Promise<PaymentResponse>;
  getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse>;
  verifyWebhookCallback(data: any): Promise<boolean>;
  processWebhookCallback(data: any): Promise<WebhookCallback>;

  // Account operations
  getBalance(accountNumber?: string): Promise<BalanceResponse>;
  
  // Health check
  healthCheck(): Promise<boolean>;

  // Optional operations
  reverseTransaction?(transactionId: string, amount: string, reason: string): Promise<PaymentResponse>;
  sendB2C?(request: PaymentRequest): Promise<PaymentResponse>;
  processBatchPayments?(payments: PaymentRequest[]): Promise<PaymentResponse[]>;
}

// Batch payment processing
export interface BatchPaymentRequest {
  payments: PaymentRequest[];
  scheduledAt?: Date;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  notificationUrl?: string;
}

export interface BatchPaymentResponse {
  batchId: string;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  results: PaymentResponse[];
  completedAt?: Date;
}

// CSV reconciliation for COOP Bank
export interface ReconciliationRecord {
  transactionId: string;
  reference: string;
  amount: string;
  phoneNumber?: string;
  status: PaymentStatus;
  completedAt: Date;
  accountNumber?: string;
  narration?: string;
}

export interface ReconciliationReport {
  providerId: PaymentProviderType;
  recordCount: number;
  matchedPayments: number;
  unmatchedPayments: number;
  discrepancies: number;
  processedAt: Date;
  records: ReconciliationRecord[];
}