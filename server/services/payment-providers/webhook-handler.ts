/**
 * Unified Webhook Handler
 * Processes payment callbacks from all payment providers
 */

import { Request, Response } from 'express';
import { getUnifiedPaymentService } from './unified-payment-service';
import { getBatchPaymentProcessor } from '../batch-payment-processor';
import { db } from '../../db';
import { payments, batchPayments } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import type { PaymentProviderType, WebhookCallback } from './types';

export interface WebhookProcessingResult {
  success: boolean;
  message: string;
  paymentId?: string;
  transactionId?: string;
  status?: string;
}

export class UnifiedWebhookHandler {
  private unifiedPaymentService = getUnifiedPaymentService();
  private batchProcessor = getBatchPaymentProcessor();

  /**
   * Process webhook from Jenga API
   */
  async processJengaWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔄 Processing Jenga webhook:', req.body);
      
      // SECURITY: Always verify webhook signature before processing
      const provider = this.unifiedPaymentService.getProvider('jenga');
      const isValid = await provider.verifyWebhookCallback(req.body);
      
      if (!isValid) {
        console.warn('🚫 SECURITY VIOLATION: Invalid Jenga webhook signature detected', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
      
      const result = await this.processProviderWebhook('jenga', req.body);
      
      if (result.success) {
        res.status(200).json({ success: true, message: 'Webhook processed successfully' });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (error: any) {
      console.error('❌ Jenga webhook processing failed:', error);
      if (error.message?.includes('Invalid webhook callback')) {
        return res.status(401).json({ success: false, message: 'Webhook verification failed' });
      }
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Process webhook from Safaricom M-Pesa
   */
  async processSafaricomWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔄 Processing Safaricom webhook:', req.body);
      
      // SECURITY: Always verify webhook signature before processing
      const provider = this.unifiedPaymentService.getProvider('safaricom');
      const isValid = await provider.verifyWebhookCallback(req.body);
      
      if (!isValid) {
        console.warn('🚫 SECURITY VIOLATION: Invalid Safaricom webhook signature detected', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        return res.status(200).json({ 
          ResultCode: 1, 
          ResultDesc: 'Invalid webhook signature - authentication failed'
        });
      }
      
      const result = await this.processProviderWebhook('safaricom', req.body);
      
      if (result.success) {
        res.status(200).json({ 
          ResultCode: 0, 
          ResultDesc: 'Service processing was successful',
          ThirdPartyTransID: result.transactionId || ''
        });
      } else {
        res.status(200).json({ 
          ResultCode: 1, 
          ResultDesc: result.message || 'Service processing failed'
        });
      }
    } catch (error: any) {
      console.error('❌ Safaricom webhook processing failed:', error);
      if (error.message?.includes('Invalid webhook callback')) {
        return res.status(200).json({ 
          ResultCode: 1, 
          ResultDesc: 'Webhook verification failed' 
        });
      }
      res.status(200).json({ 
        ResultCode: 1, 
        ResultDesc: 'Internal server error' 
      });
    }
  }

  /**
   * Process webhook from COOP Bank
   */
  async processCoopWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔄 Processing COOP webhook:', req.body);
      
      // SECURITY: Always verify webhook signature before processing
      const provider = this.unifiedPaymentService.getProvider('coop');
      const isValid = await provider.verifyWebhookCallback(req.body);
      
      if (!isValid) {
        console.warn('🚫 SECURITY VIOLATION: Invalid COOP webhook signature detected', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
      
      const result = await this.processProviderWebhook('coop', req.body);
      
      if (result.success) {
        res.status(200).json({ success: true, message: 'Webhook processed successfully' });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (error: any) {
      console.error('❌ COOP webhook processing failed:', error);
      if (error.message?.includes('Invalid webhook callback')) {
        return res.status(401).json({ success: false, message: 'Webhook verification failed' });
      }
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Generic webhook processor for any provider
   * NOTE: Webhook signature verification must be done by caller before calling this method
   */
  private async processProviderWebhook(
    providerType: PaymentProviderType, 
    webhookData: any
  ): Promise<WebhookProcessingResult> {
    try {
      // Process webhook through unified service
      // SECURITY NOTE: Signature verification is already handled by individual webhook methods
      const webhookCallback = await this.unifiedPaymentService.processWebhookCallback(
        webhookData, 
        providerType
      );

      console.log(`📨 Processed ${providerType} webhook:`, {
        transactionId: webhookCallback.transactionId,
        reference: webhookCallback.reference,
        status: webhookCallback.status,
        amount: webhookCallback.amount,
      });

      // Update payment record in database
      const updateResult = await this.updatePaymentRecord(webhookCallback);
      
      if (!updateResult.found) {
        console.warn(`⚠️ Payment record not found for transaction ${webhookCallback.transactionId}`);
        // Create new payment record for unmatched transactions
        await this.createUnmatchedPaymentRecord(webhookCallback, providerType);
      }

      // Update batch status if this payment is part of a batch
      await this.updateBatchStatus(webhookCallback);

      // Trigger any post-processing (notifications, reports, etc.)
      await this.triggerPostProcessing(webhookCallback);

      return {
        success: true,
        message: 'Webhook processed successfully',
        paymentId: updateResult.paymentId,
        transactionId: webhookCallback.transactionId,
        status: webhookCallback.status,
      };

    } catch (error: any) {
      console.error(`❌ ${providerType} webhook processing error:`, error);
      return {
        success: false,
        message: error.message || 'Webhook processing failed',
        transactionId: webhookData.transactionId || '',
      };
    }
  }

  /**
   * Update existing payment record with webhook data
   */
  private async updatePaymentRecord(webhookCallback: WebhookCallback): Promise<{ found: boolean; paymentId?: string }> {
    try {
      // Try to find payment by transaction ID, reference, or provider-specific fields
      const existingPayments = await db
        .select()
        .from(payments)
        .where(
          sql`
            ${payments.transactionId} = ${webhookCallback.transactionId} OR
            ${payments.reference} = ${webhookCallback.reference} OR
            ${payments.mpesaTransactionId} = ${webhookCallback.transactionId} OR
            ${payments.checkoutRequestId} = ${webhookCallback.transactionId}
          `
        )
        .limit(1);

      if (existingPayments.length === 0) {
        return { found: false };
      }

      const payment = existingPayments[0];
      
      // Prepare update data
      const updateData: any = {
        paymentStatus: webhookCallback.status,
        updatedAt: new Date(),
      };

      // Add provider-specific fields
      if (webhookCallback.transactionId) {
        updateData.transactionId = webhookCallback.transactionId;
      }

      if (webhookCallback.receiptNumber) {
        updateData.receiptNumber = webhookCallback.receiptNumber;
        
        // For backward compatibility with M-Pesa fields
        if (webhookCallback.providerType === 'safaricom' || webhookCallback.providerType === 'jenga') {
          updateData.mpesaReceiptNumber = webhookCallback.receiptNumber;
          updateData.mpesaTransactionId = webhookCallback.transactionId;
        }
      }

      if (webhookCallback.completedAt) {
        updateData.paidDate = new Date(webhookCallback.completedAt);
      }

      if (webhookCallback.failureReason) {
        updateData.failureReason = webhookCallback.failureReason;
      }

      if (webhookCallback.providerData) {
        updateData.providerData = webhookCallback.providerData;
      }

      // Update notes with webhook information
      const webhookNote = `Webhook update: ${webhookCallback.status} at ${new Date().toISOString()}`;
      updateData.notes = payment.notes ? `${payment.notes} | ${webhookNote}` : webhookNote;

      // Perform update
      await db
        .update(payments)
        .set(updateData)
        .where(eq(payments.id, payment.id));

      console.log(`✅ Updated payment ${payment.id} status to ${webhookCallback.status}`);
      
      return { found: true, paymentId: payment.id };

    } catch (error: any) {
      console.error('❌ Error updating payment record:', error);
      throw error;
    }
  }

  /**
   * Create payment record for unmatched webhook transactions
   */
  private async createUnmatchedPaymentRecord(
    webhookCallback: WebhookCallback, 
    providerType: PaymentProviderType
  ): Promise<void> {
    try {
      const currentDate = new Date();
      const month = currentDate.toISOString().slice(0, 7);

      const paymentData = {
        // Use placeholder values for required fields
        tenantId: sql`NULL`, // Will need to be matched later
        roomId: sql`NULL`,   // Will need to be matched later
        amount: webhookCallback.amount || '0',
        paymentMethod: 'mpesa' as const,
        paymentStatus: webhookCallback.status,
        paymentProvider: providerType,
        transactionId: webhookCallback.transactionId,
        reference: webhookCallback.reference || `UNMATCHED-${webhookCallback.transactionId}`,
        receiptNumber: webhookCallback.receiptNumber,
        phoneNumber: webhookCallback.phoneNumber,
        dueDate: currentDate,
        paidDate: webhookCallback.status === 'completed' && webhookCallback.completedAt 
          ? new Date(webhookCallback.completedAt) 
          : null,
        month,
        year: currentDate.getFullYear(),
        notes: `Unmatched webhook payment from ${providerType} - requires manual reconciliation`,
        providerData: webhookCallback.providerData,
        failureReason: webhookCallback.failureReason,
      };

      await db.insert(payments).values(paymentData);
      
      console.log(`📝 Created unmatched payment record for transaction ${webhookCallback.transactionId}`);

    } catch (error: any) {
      console.error('❌ Error creating unmatched payment record:', error);
      throw error;
    }
  }

  /**
   * Update batch processing status
   */
  private async updateBatchStatus(webhookCallback: WebhookCallback): Promise<void> {
    try {
      // Find if this payment is part of a batch
      const batchPayment = await db
        .select()
        .from(payments)
        .where(
          and(
            sql`${payments.notes} LIKE '%batch_id:%'`,
            sql`(
              ${payments.transactionId} = ${webhookCallback.transactionId} OR
              ${payments.reference} = ${webhookCallback.reference}
            )`
          )
        )
        .limit(1);

      if (batchPayment.length === 0) {
        return; // Not part of a batch
      }

      // Extract batch ID from notes
      const batchIdMatch = batchPayment[0].notes?.match(/batch_id:([a-f0-9-]+)/);
      if (!batchIdMatch) {
        return;
      }

      const batchId = batchIdMatch[1];

      // Get current batch status
      const batchStatus = await this.batchProcessor.getBatchStatus(batchId);
      
      // Update batch counters based on webhook status
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (webhookCallback.status === 'completed') {
        updateData.successfulPayments = (batchStatus.successfulPayments || 0) + 1;
      } else if (webhookCallback.status === 'failed') {
        updateData.failedPayments = (batchStatus.failedPayments || 0) + 1;
      }

      // Check if batch is complete
      const totalProcessed = (updateData.successfulPayments || batchStatus.successfulPayments || 0) + 
                           (updateData.failedPayments || batchStatus.failedPayments || 0);
      
      if (totalProcessed >= batchStatus.totalPayments) {
        updateData.status = 'completed';
        updateData.completedAt = new Date();
      }

      await db
        .update(batchPayments)
        .set(updateData)
        .where(eq(batchPayments.id, batchId));

      console.log(`📊 Updated batch ${batchId} progress: ${totalProcessed}/${batchStatus.totalPayments}`);

    } catch (error: any) {
      console.error('❌ Error updating batch status:', error);
      // Don't throw - batch update failure shouldn't fail webhook processing
    }
  }

  /**
   * Trigger post-processing actions
   */
  private async triggerPostProcessing(webhookCallback: WebhookCallback): Promise<void> {
    try {
      // Send confirmation SMS for completed payments
      if (webhookCallback.status === 'completed' && webhookCallback.phoneNumber) {
        // TODO: Implement SMS notification
        console.log(`📱 TODO: Send confirmation SMS to ${webhookCallback.phoneNumber}`);
      }

      // Log important events
      if (webhookCallback.status === 'completed') {
        console.log(`🎉 Payment completed: ${webhookCallback.amount} KSh from ${webhookCallback.phoneNumber}`);
      } else if (webhookCallback.status === 'failed') {
        console.log(`❌ Payment failed: ${webhookCallback.failureReason || 'Unknown reason'}`);
      }

      // TODO: Add other post-processing actions:
      // - Update dashboard metrics cache
      // - Trigger accounting system updates
      // - Generate reports
      // - Send landlord notifications

    } catch (error: any) {
      console.error('❌ Post-processing error:', error);
      // Don't throw - post-processing failure shouldn't fail webhook processing
    }
  }
}

// Singleton instance
let webhookHandler: UnifiedWebhookHandler | null = null;

export function getUnifiedWebhookHandler(): UnifiedWebhookHandler {
  if (!webhookHandler) {
    webhookHandler = new UnifiedWebhookHandler();
  }
  return webhookHandler;
}