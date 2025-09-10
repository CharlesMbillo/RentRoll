/**
 * Payment Provider Configuration Service
 * Handles loading, validation, and management of payment provider configurations
 */

import { z } from 'zod';
import { storage } from '../../storage';

// Environment variable schemas for each provider
const JengaConfigSchema = z.object({
  JENGA_API_KEY: z.string().min(1, 'Jenga API key is required'),
  JENGA_CONSUMER_KEY: z.string().min(1, 'Jenga consumer key is required'),
  JENGA_CONSUMER_SECRET: z.string().min(1, 'Jenga consumer secret is required'),
  JENGA_MERCHANT_CODE: z.string().min(1, 'Jenga merchant code is required'),
  JENGA_BASE_URL: z.string().url().optional(),
  JENGA_CALLBACK_URL: z.string().url().optional(),
});

const SafaricomConfigSchema = z.object({
  SAFARICOM_CONSUMER_KEY: z.string().min(1, 'Safaricom consumer key is required'),
  SAFARICOM_CONSUMER_SECRET: z.string().min(1, 'Safaricom consumer secret is required'),
  SAFARICOM_SHORT_CODE: z.string().min(1, 'Safaricom short code is required'),
  SAFARICOM_PASSKEY: z.string().min(1, 'Safaricom passkey is required'),
  SAFARICOM_INITIATOR_NAME: z.string().min(1, 'Safaricom initiator name is required'),
  SAFARICOM_SECURITY_CREDENTIAL: z.string().min(1, 'Safaricom security credential is required'),
  SAFARICOM_CALLBACK_URL: z.string().url().optional(),
});

const CoopConfigSchema = z.object({
  COOP_API_KEY: z.string().min(1, 'COOP API key is required'),
  COOP_MERCHANT_CODE: z.string().min(1, 'COOP merchant code is required'),
  COOP_BASE_URL: z.string().url().optional(),
  COOP_CALLBACK_URL: z.string().url().optional(),
});

// Configuration interfaces
export interface ValidatedProviderConfig {
  enabled: boolean;
  sandbox: boolean;
  baseUrl: string;
  apiKey: string;
  consumerKey?: string;
  consumerSecret?: string;
  merchantCode?: string;
  shortCode?: string;
  passkey?: string;
  initiatorName?: string;
  securityCredential?: string;
  callbackUrl: string;
  timeout: number;
  validationErrors?: string[];
}

export interface ProviderConfigStatus {
  type: 'jenga' | 'safaricom' | 'coop';
  enabled: boolean;
  configured: boolean;
  validationErrors: string[];
  lastValidated: Date;
}

class ProviderConfigurationService {
  private configCache = new Map<string, ValidatedProviderConfig>();
  private validationCache = new Map<string, ProviderConfigStatus>();

  /**
   * Load and validate configuration for a specific provider
   */
  async loadProviderConfig(providerType: 'jenga' | 'safaricom' | 'coop'): Promise<ValidatedProviderConfig> {
    const cacheKey = `${providerType}_config`;
    
    // Return cached config if available and recent
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    let config: ValidatedProviderConfig;
    let validationErrors: string[] = [];

    try {
      switch (providerType) {
        case 'jenga':
          config = await this.loadJengaConfig();
          break;
        case 'safaricom':
          config = await this.loadSafaricomConfig();
          break;
        case 'coop':
          config = await this.loadCoopConfig();
          break;
        default:
          throw new Error(`Unknown provider type: ${providerType}`);
      }
    } catch (error) {
      console.error(`❌ Failed to load ${providerType} configuration:`, error);
      
      if (error instanceof z.ZodError) {
        validationErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      } else {
        validationErrors = [error instanceof Error ? error.message : 'Unknown configuration error'];
      }

      // Return disabled config on validation failure
      config = this.getDisabledConfig(providerType, validationErrors);
    }

    // Cache the configuration
    this.configCache.set(cacheKey, config);
    
    // Store validation status in database
    await this.storeProviderConfigStatus(providerType, config, validationErrors);
    
    return config;
  }

  /**
   * Load Jenga provider configuration
   */
  private async loadJengaConfig(): Promise<ValidatedProviderConfig> {
    const envVars = JengaConfigSchema.parse(process.env);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = envVars.JENGA_BASE_URL || (isProduction 
      ? 'https://api.jengahq.io' 
      : 'https://sandbox.jengahq.io');
    
    const defaultCallbackUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/jenga`;

    return {
      enabled: true,
      sandbox: !isProduction,
      baseUrl,
      apiKey: envVars.JENGA_API_KEY,
      consumerKey: envVars.JENGA_CONSUMER_KEY,
      consumerSecret: envVars.JENGA_CONSUMER_SECRET,
      merchantCode: envVars.JENGA_MERCHANT_CODE,
      callbackUrl: envVars.JENGA_CALLBACK_URL || defaultCallbackUrl,
      timeout: 30000,
    };
  }

  /**
   * Load Safaricom provider configuration
   */
  private async loadSafaricomConfig(): Promise<ValidatedProviderConfig> {
    const envVars = SafaricomConfigSchema.parse(process.env);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
    
    const defaultCallbackUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/safaricom`;

    return {
      enabled: true,
      sandbox: !isProduction,
      baseUrl,
      apiKey: '', // Not used for Safaricom
      consumerKey: envVars.SAFARICOM_CONSUMER_KEY,
      consumerSecret: envVars.SAFARICOM_CONSUMER_SECRET,
      shortCode: envVars.SAFARICOM_SHORT_CODE,
      passkey: envVars.SAFARICOM_PASSKEY,
      initiatorName: envVars.SAFARICOM_INITIATOR_NAME,
      securityCredential: envVars.SAFARICOM_SECURITY_CREDENTIAL,
      callbackUrl: envVars.SAFARICOM_CALLBACK_URL || defaultCallbackUrl,
      timeout: 30000,
    };
  }

  /**
   * Load COOP provider configuration
   */
  private async loadCoopConfig(): Promise<ValidatedProviderConfig> {
    const envVars = CoopConfigSchema.parse(process.env);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = envVars.COOP_BASE_URL || (isProduction 
      ? 'https://api.co-opbank.co.ke' 
      : 'https://sandbox.co-opbank.co.ke');
    
    const defaultCallbackUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/coop`;

    return {
      enabled: true,
      sandbox: !isProduction,
      baseUrl,
      apiKey: envVars.COOP_API_KEY,
      merchantCode: envVars.COOP_MERCHANT_CODE,
      callbackUrl: envVars.COOP_CALLBACK_URL || defaultCallbackUrl,
      timeout: 60000, // Longer timeout for batch operations
    };
  }

  /**
   * Get disabled configuration for failed providers
   */
  private getDisabledConfig(providerType: string, validationErrors: string[]): ValidatedProviderConfig {
    const defaultCallbackUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/${providerType}`;
    
    return {
      enabled: false,
      sandbox: true,
      baseUrl: '',
      apiKey: '',
      callbackUrl: defaultCallbackUrl,
      timeout: 30000,
      validationErrors,
    };
  }

  /**
   * Store provider configuration status in database
   */
  private async storeProviderConfigStatus(
    providerType: 'jenga' | 'safaricom' | 'coop',
    config: ValidatedProviderConfig,
    validationErrors: string[]
  ): Promise<void> {
    try {
      // Check if provider already exists
      const existingProvider = await storage.getPaymentProviderByType(providerType);
      
      const providerData = {
        providerType,
        enabled: config.enabled,
        sandbox: config.sandbox,
        config: {
          baseUrl: config.baseUrl,
          callbackUrl: config.callbackUrl,
          timeout: config.timeout,
          // Don't store sensitive data like API keys in the database
        },
        capabilities: this.getProviderCapabilities(providerType),
        healthStatus: (config.enabled ? 'unknown' : 'unhealthy') as "healthy" | "unhealthy" | "unknown",
        lastHealthCheck: new Date(),
      };

      if (existingProvider) {
        await storage.updatePaymentProvider(existingProvider.id, providerData);
      } else {
        await storage.createPaymentProvider(providerData);
      }

      // Cache validation status
      this.validationCache.set(providerType, {
        type: providerType,
        enabled: config.enabled,
        configured: config.enabled,
        validationErrors,
        lastValidated: new Date(),
      });

      console.log(`✅ ${providerType.toUpperCase()} configuration ${config.enabled ? 'loaded' : 'disabled'}`);
      
      if (validationErrors.length > 0) {
        console.warn(`⚠️ ${providerType.toUpperCase()} validation errors:`, validationErrors);
      }
    } catch (error) {
      console.error(`Failed to store ${providerType} configuration status:`, error);
    }
  }

  /**
   * Get provider capabilities
   */
  private getProviderCapabilities(providerType: 'jenga' | 'safaricom' | 'coop') {
    const capabilities = {
      jenga: {
        stkPush: true,
        b2c: true,
        b2b: true,
        balance: true,
        reversal: true,
        webhook: true,
        csv_reconciliation: false,
        batch_processing: true,
      },
      safaricom: {
        stkPush: true,
        b2c: true,
        b2b: true,
        balance: true,
        reversal: true,
        webhook: true,
        csv_reconciliation: false,
        batch_processing: true,
      },
      coop: {
        stkPush: false,
        b2c: true,
        b2b: true,
        balance: true,
        reversal: true,
        webhook: false,
        csv_reconciliation: true,
        batch_processing: true,
      },
    };

    return capabilities[providerType];
  }

  /**
   * Get all provider configuration statuses
   */
  async getAllProviderStatuses(): Promise<ProviderConfigStatus[]> {
    const providers: ('jenga' | 'safaricom' | 'coop')[] = ['jenga', 'safaricom', 'coop'];
    const statuses: ProviderConfigStatus[] = [];

    for (const providerType of providers) {
      if (this.validationCache.has(providerType)) {
        statuses.push(this.validationCache.get(providerType)!);
      } else {
        // Load config to populate validation cache
        await this.loadProviderConfig(providerType);
        if (this.validationCache.has(providerType)) {
          statuses.push(this.validationCache.get(providerType)!);
        }
      }
    }

    return statuses;
  }

  /**
   * Validate all provider configurations
   */
  async validateAllProviders(): Promise<Record<string, ProviderConfigStatus>> {
    const providers: ('jenga' | 'safaricom' | 'coop')[] = ['jenga', 'safaricom', 'coop'];
    const results: Record<string, ProviderConfigStatus> = {};

    for (const providerType of providers) {
      await this.loadProviderConfig(providerType);
      const status = this.validationCache.get(providerType);
      if (status) {
        results[providerType] = status;
      }
    }

    return results;
  }

  /**
   * Clear configuration cache (useful for reloading configs)
   */
  clearCache(): void {
    this.configCache.clear();
    this.validationCache.clear();
  }

  /**
   * Get configuration validation summary
   */
  getConfigurationSummary(): {
    configuredProviders: string[];
    enabledProviders: string[];
    disabledProviders: string[];
    errors: Record<string, string[]>;
  } {
    const summary = {
      configuredProviders: [] as string[],
      enabledProviders: [] as string[],
      disabledProviders: [] as string[],
      errors: {} as Record<string, string[]>,
    };

    const cacheEntries = Array.from(this.validationCache.entries());
    for (const [provider, status] of cacheEntries) {
      if (status.configured) {
        summary.configuredProviders.push(provider);
      }
      
      if (status.enabled) {
        summary.enabledProviders.push(provider);
      } else {
        summary.disabledProviders.push(provider);
      }

      if (status.validationErrors.length > 0) {
        summary.errors[provider] = status.validationErrors;
      }
    }

    return summary;
  }
}

// Singleton instance
export const providerConfigService = new ProviderConfigurationService();

// Helper function to get provider configuration
export async function getProviderConfig(providerType: 'jenga' | 'safaricom' | 'coop'): Promise<ValidatedProviderConfig> {
  return await providerConfigService.loadProviderConfig(providerType);
}

// Helper function to validate all providers at startup
export async function initializeProviderConfigurations(): Promise<void> {
  console.log('🔧 Initializing payment provider configurations...');
  
  const results = await providerConfigService.validateAllProviders();
  const summary = providerConfigService.getConfigurationSummary();
  
  console.log('💳 Payment Provider Configuration Summary:');
  console.log(`✅ Configured: ${summary.configuredProviders.join(', ') || 'none'}`);
  console.log(`🟢 Enabled: ${summary.enabledProviders.join(', ') || 'none'}`);
  console.log(`🔴 Disabled: ${summary.disabledProviders.join(', ') || 'none'}`);
  
  if (Object.keys(summary.errors).length > 0) {
    console.warn('⚠️ Configuration errors:');
    for (const [provider, errors] of Object.entries(summary.errors)) {
      console.warn(`  ${provider}: ${errors.join(', ')}`);
    }
  }
}