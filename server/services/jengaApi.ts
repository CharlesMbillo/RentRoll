import axios, { AxiosInstance } from 'axios';

export interface JengaConfig {
  baseUrl: string;
  apiKey: string;
  merchantCode: string;
  consumerSecret: string;
  isProduction?: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface PaymentRequest {
  sourceAccount: string;
  destinationAccount: string;
  amount: string;
  currency: string;
  narration: string;
  reference: string;
  recipientName?: string;
  recipientMobile?: string;
}

export interface PaymentResponse {
  transactionId: string;
  status: string;
  message: string;
  reference: string;
}

export interface AccountBalanceResponse {
  accountNumber: string;
  currency: string;
  balances: {
    available: string;
    actual: string;
  };
}

export interface SendMoneyRequest {
  source: {
    accountNumber: string;
    countryCode: string;
  };
  destination: {
    type: 'mobile' | 'account';
    countryCode: string;
    name: string;
    accountNumber?: string;
    mobileNumber?: string;
  };
  transfer: {
    type: 'MobileMoneyTransfer' | 'InternalFundsTransfer' | 'RTGSTransfer';
    amount: string;
    currencyCode: string;
    reference: string;
    date: string;
    description: string;
  };
}

export class JengaApiClient {
  private client: AxiosInstance;
  private config: JengaConfig;
  private accessToken: string | null = null;
  private tokenExpiryTime: number = 0;

  constructor(config: JengaConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': config.apiKey,
      },
    });

    // Add request interceptor to handle auth token
    this.client.interceptors.request.use(async (config: any) => {
      const token = await this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        console.error('JengaAPI Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * Get access token for authentication
   */
  private async getAccessToken(): Promise<string | null> {
    // Check if token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiryTime) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<AuthResponse>(
        `${this.config.baseUrl}/identity-sandbox/v2/token`,
        {
          merchantCode: this.config.merchantCode,
          consumerSecret: this.config.consumerSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': this.config.apiKey,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry time with 5-minute buffer
      this.tokenExpiryTime = Date.now() + (response.data.expires_in - 300) * 1000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get JengaAPI access token:', error);
      return null;
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountNumber: string, countryCode: string = 'KE'): Promise<AccountBalanceResponse> {
    const response = await this.client.get(
      `/account-sandbox/v2/accounts/balances/${countryCode}/${accountNumber}`
    );
    return response.data;
  }

  /**
   * Send money via mobile money (M-Pesa, Airtel, etc.)
   */
  async sendMobileMoney(request: SendMoneyRequest): Promise<PaymentResponse> {
    const response = await this.client.post('/send-money-sandbox/v2/remittance', request);
    return response.data;
  }

  /**
   * Send M-Pesa STK Push for rent payment
   */
  async sendMpesaSTKPush(phoneNumber: string, amount: string, reference: string, description: string): Promise<PaymentResponse> {
    const sendMoneyRequest: SendMoneyRequest = {
      source: {
        accountNumber: this.config.merchantCode, // Use merchant account as source
        countryCode: 'KE',
      },
      destination: {
        type: 'mobile',
        countryCode: 'KE',
        name: 'Tenant Payment',
        mobileNumber: phoneNumber,
      },
      transfer: {
        type: 'MobileMoneyTransfer',
        amount: amount,
        currencyCode: 'KES',
        reference: reference,
        date: new Date().toISOString().split('T')[0],
        description: description,
      },
    };

    return await this.sendMobileMoney(sendMoneyRequest);
  }

  /**
   * Check payment status
   */
  async getPaymentStatus(transactionId: string): Promise<any> {
    const response = await this.client.get(`/send-money-sandbox/v2/remittance/status/${transactionId}`);
    return response.data;
  }

  /**
   * Verify payment callback/webhook
   */
  async verifyPaymentCallback(callbackData: any): Promise<boolean> {
    try {
      // Implement signature verification logic here
      // This would verify the callback is legitimate from JengaAPI
      return true;
    } catch (error) {
      console.error('Failed to verify payment callback:', error);
      return false;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(accountNumber: string, countryCode: string = 'KE', fromDate?: string, toDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    
    const response = await this.client.get(
      `/account-sandbox/v2/accounts/transactions/${countryCode}/${accountNumber}?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Perform KYC verification for tenant
   */
  async verifyKYC(nationalId: string, firstName: string, lastName: string): Promise<any> {
    const response = await this.client.post('/identity-sandbox/v2/validation', {
      documentNumber: nationalId,
      documentType: 'ID',
      firstName: firstName,
      lastName: lastName,
      countryCode: 'KE',
    });
    return response.data;
  }

  /**
   * Health check to test API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      return token !== null;
    } catch (error) {
      console.error('JengaAPI health check failed:', error);
      return false;
    }
  }
}

// Factory function to create JengaAPI client
export function createJengaApiClient(config?: Partial<JengaConfig>): JengaApiClient {
  const defaultConfig: JengaConfig = {
    baseUrl: process.env.JENGA_BASE_URL || 'https://api-test.equitybankgroup.com',
    apiKey: process.env.JENGA_API_KEY || '',
    merchantCode: process.env.JENGA_MERCHANT_CODE || '',
    consumerSecret: process.env.JENGA_CONSUMER_SECRET || '',
    isProduction: process.env.NODE_ENV === 'production',
  };

  return new JengaApiClient({ ...defaultConfig, ...config });
}