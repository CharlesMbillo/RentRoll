/**
 * Webhook Signature Verification Middleware
 * Provides signature verification for payment provider webhooks
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export interface WebhookVerificationConfig {
  provider: 'jenga' | 'safaricom' | 'coop';
  secret?: string;
  algorithm?: 'sha256' | 'sha1' | 'md5';
  headerName?: string;
  encoding?: 'hex' | 'base64';
}

export class WebhookVerificationError extends Error {
  constructor(message: string, public provider: string, public reason: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

/**
 * Webhook signature verification middleware factory
 */
export function createWebhookVerificationMiddleware(config: WebhookVerificationConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isValid = await verifyWebhookSignature(req, config);
      
      if (!isValid) {
        console.warn(`🚫 Webhook signature verification failed for ${config.provider}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature',
          provider: config.provider
        });
      }

      console.log(`✅ Webhook signature verified for ${config.provider}`);
      next();
    } catch (error) {
      console.error(`❌ Webhook verification error for ${config.provider}:`, error);
      
      if (error instanceof WebhookVerificationError) {
        return res.status(401).json({
          success: false,
          message: error.message,
          provider: error.provider,
          reason: error.reason
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal verification error',
        provider: config.provider
      });
    }
  };
}

/**
 * Verify webhook signature based on provider configuration
 */
export async function verifyWebhookSignature(
  req: Request, 
  config: WebhookVerificationConfig
): Promise<boolean> {
  switch (config.provider) {
    case 'jenga':
      return verifyJengaWebhook(req, config);
    case 'safaricom':
      return verifySafaricomWebhook(req, config);
    case 'coop':
      return verifyCoopWebhook(req, config);
    default:
      throw new WebhookVerificationError(
        `Unsupported provider: ${config.provider}`,
        config.provider,
        'unsupported_provider'
      );
  }
}

/**
 * Verify Jenga webhook signature
 */
function verifyJengaWebhook(req: Request, config: WebhookVerificationConfig): boolean {
  // In development mode, skip verification if no secret is configured
  if (process.env.NODE_ENV === 'development' && !config.secret) {
    console.log('🔧 DEV MODE: Skipping Jenga webhook verification');
    return true;
  }

  const secret = config.secret || process.env.JENGA_WEBHOOK_SECRET;
  if (!secret) {
    throw new WebhookVerificationError(
      'Jenga webhook secret not configured',
      'jenga',
      'missing_secret'
    );
  }

  // Get signature from headers (Jenga typically uses X-Jenga-Signature)
  const receivedSignature = (req.headers['x-jenga-signature'] || req.headers['x-signature']) as string;
  if (!receivedSignature) {
    throw new WebhookVerificationError(
      'Missing Jenga webhook signature header',
      'jenga',
      'missing_signature'
    );
  }

  // Create expected signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac(config.algorithm || 'sha256', secret)
    .update(payload, 'utf8')
    .digest(config.encoding || 'hex');

  // Compare signatures (time-safe comparison)
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Verify Safaricom webhook signature
 */
function verifySafaricomWebhook(req: Request, config: WebhookVerificationConfig): boolean {
  // In development mode, skip verification if no secret is configured
  if (process.env.NODE_ENV === 'development' && !config.secret) {
    console.log('🔧 DEV MODE: Skipping Safaricom webhook verification');
    return true;
  }

  // Safaricom doesn't use traditional webhook signatures
  // Instead, they verify through other means like IP whitelisting and timestamps
  
  // Check for required Safaricom webhook fields
  const body = req.body;
  if (!body.Body || !body.Body.stkCallback) {
    throw new WebhookVerificationError(
      'Invalid Safaricom webhook format',
      'safaricom',
      'invalid_format'
    );
  }

  // In production, you would typically:
  // 1. Verify the source IP is from Safaricom's allowed IPs
  // 2. Check timestamp to prevent replay attacks
  // 3. Validate the structure of the callback

  // For now, validate the basic structure
  const callback = body.Body.stkCallback;
  if (!callback.MerchantRequestID || !callback.CheckoutRequestID) {
    throw new WebhookVerificationError(
      'Missing required Safaricom callback fields',
      'safaricom',
      'missing_fields'
    );
  }

  return true;
}

/**
 * Verify COOP webhook signature
 */
function verifyCoopWebhook(req: Request, config: WebhookVerificationConfig): boolean {
  // In development mode, skip verification if no secret is configured
  if (process.env.NODE_ENV === 'development' && !config.secret) {
    console.log('🔧 DEV MODE: Skipping COOP webhook verification');
    return true;
  }

  const secret = config.secret || process.env.COOP_WEBHOOK_SECRET;
  if (!secret) {
    throw new WebhookVerificationError(
      'COOP webhook secret not configured',
      'coop',
      'missing_secret'
    );
  }

  // Get signature from headers (COOP typically uses X-COOP-Signature)
  const receivedSignature = (req.headers['x-coop-signature'] || req.headers['authorization']) as string;
  if (!receivedSignature) {
    throw new WebhookVerificationError(
      'Missing COOP webhook signature header',
      'coop',
      'missing_signature'
    );
  }

  // Create expected signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac(config.algorithm || 'sha256', secret)
    .update(payload, 'utf8')
    .digest(config.encoding || 'hex');

  // Compare signatures (time-safe comparison)
  const cleanSignature = typeof receivedSignature === 'string' ? receivedSignature.replace('sha256=', '') : receivedSignature;
  return crypto.timingSafeEqual(
    Buffer.from(cleanSignature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Get webhook verification configuration for a provider
 */
export function getWebhookVerificationConfig(
  provider: 'jenga' | 'safaricom' | 'coop'
): WebhookVerificationConfig {
  const configs = {
    jenga: {
      provider: 'jenga' as const,
      secret: process.env.JENGA_WEBHOOK_SECRET,
      algorithm: 'sha256' as const,
      headerName: 'x-jenga-signature',
      encoding: 'hex' as const,
    },
    safaricom: {
      provider: 'safaricom' as const,
      secret: process.env.SAFARICOM_WEBHOOK_SECRET,
      algorithm: 'sha256' as const,
      headerName: 'x-safaricom-signature',
      encoding: 'hex' as const,
    },
    coop: {
      provider: 'coop' as const,
      secret: process.env.COOP_WEBHOOK_SECRET,
      algorithm: 'sha256' as const,
      headerName: 'x-coop-signature',
      encoding: 'hex' as const,
    },
  };

  return configs[provider];
}

/**
 * Universal webhook verification middleware that automatically detects provider
 */
export function createUniversalWebhookVerification() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract provider from URL path
      const provider = req.params.provider as 'jenga' | 'safaricom' | 'coop';
      
      if (!provider || !['jenga', 'safaricom', 'coop'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or missing provider in webhook URL'
        });
      }

      const config = getWebhookVerificationConfig(provider);
      const isValid = await verifyWebhookSignature(req, config);
      
      if (!isValid) {
        console.warn(`🚫 Universal webhook verification failed for ${provider}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature',
          provider
        });
      }

      console.log(`✅ Universal webhook signature verified for ${provider}`);
      next();
    } catch (error) {
      console.error('❌ Universal webhook verification error:', error);
      
      if (error instanceof WebhookVerificationError) {
        return res.status(401).json({
          success: false,
          message: error.message,
          provider: error.provider,
          reason: error.reason
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal verification error'
      });
    }
  };
}

/**
 * Development mode webhook verification bypass
 */
export function createDevWebhookVerification() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 DEV MODE: Bypassing webhook verification');
      return next();
    }
    
    // In production, use proper verification
    return createUniversalWebhookVerification()(req, res, next);
  };
}

/**
 * Webhook verification status endpoint
 */
export function getWebhookVerificationStatus(): {
  enabled: boolean;
  providers: Record<string, { configured: boolean; secret_available: boolean }>;
  development_mode: boolean;
} {
  const isDev = process.env.NODE_ENV === 'development';
  
  return {
    enabled: !isDev,
    providers: {
      jenga: {
        configured: !!process.env.JENGA_WEBHOOK_SECRET,
        secret_available: !!process.env.JENGA_WEBHOOK_SECRET,
      },
      safaricom: {
        configured: true, // Safaricom uses different verification method
        secret_available: !!process.env.SAFARICOM_WEBHOOK_SECRET,
      },
      coop: {
        configured: !!process.env.COOP_WEBHOOK_SECRET,
        secret_available: !!process.env.COOP_WEBHOOK_SECRET,
      },
    },
    development_mode: isDev,
  };
}