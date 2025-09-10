/**
 * Batch Payment Processor
 * Handles scheduled batch payments for rent collection
 */

import { db } from '../db';
import { batchPayments, payments, tenants, rooms, properties } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getUnifiedPaymentService } from './payment-providers/unified-payment-service';
import type { 
  PaymentRequest, 
  BatchPaymentRequest, 
  BatchPaymentResponse,
  PaymentProviderType 
} from './payment-providers/types';

export interface MonthlyRentBatchOptions {
  month: string; // Format: YYYY-MM
  dueDate: Date;
  providerId?: PaymentProviderType;
  testMode?: boolean;
  includeTenantsWithIds?: string[]; // Filter to specific tenants
  excludeTenantsWithIds?: string[]; // Exclude specific tenants
  minAmount?: number;
  maxAmount?: number;
}

export interface BatchProcessingResult {
  batchId: string;
  totalTenants: number;
  totalAmount: string;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  processingTime: number;
  errors: string[];
}

export class BatchPaymentProcessor {
  private unifiedPaymentService = getUnifiedPaymentService();

  /**
   * Process monthly rent collection for all tenants
   */
  async processMonthlyRentCollection(options: MonthlyRentBatchOptions): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    console.log(`🏠 Starting monthly rent collection for ${options.month}`);

    try {
      // Create batch record
      const batchRecord = await this.createBatchRecord('monthly_rent', options);
      
      // Get tenants with their room and rent information
      const tenantRentData = await this.getTenantsForRentCollection(options);
      
      if (tenantRentData.length === 0) {
        console.log('❌ No tenants found for rent collection');
        await this.updateBatchRecord(batchRecord.id, 'failed', 'No tenants found');
        return this.createErrorResult(batchRecord.id, 'No tenants found for rent collection');
      }

      console.log(`👥 Found ${tenantRentData.length} tenants for rent collection`);

      // Create payment requests
      const paymentRequests = tenantRentData.map(tenant => this.createPaymentRequest(tenant, options));
      
      // Calculate total amount
      const totalAmount = paymentRequests.reduce((sum, req) => sum + parseFloat(req.amount), 0);
      
      console.log(`💰 Total amount to collect: KSh ${totalAmount.toLocaleString()}`);

      if (options.testMode) {
        console.log('🧪 TEST MODE: Not sending actual payment requests');
        return this.createTestResult(batchRecord.id, paymentRequests, totalAmount);
      }

      // Process batch payments
      await this.updateBatchRecord(batchRecord.id, 'processing');
      
      const batchRequest: BatchPaymentRequest = {
        payments: paymentRequests,
        scheduledAt: new Date(),
        priority: 'normal',
        retryCount: 0,
      };

      const batchResponse = await this.unifiedPaymentService.processBatchPayments(batchRequest);

      // Store individual payment records in database
      await this.storePaymentRecords(batchResponse, tenantRentData, options);

      // Update batch record with results
      await this.updateBatchRecord(
        batchRecord.id, 
        'completed', 
        null,
        batchResponse.successfulPayments,
        batchResponse.failedPayments,
        batchResponse.pendingPayments,
        batchResponse
      );

      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Monthly rent collection completed in ${processingTime}ms:`, {
        successful: batchResponse.successfulPayments,
        failed: batchResponse.failedPayments,
        pending: batchResponse.pendingPayments,
      });

      return {
        batchId: batchRecord.id,
        totalTenants: tenantRentData.length,
        totalAmount: totalAmount.toFixed(2),
        successfulPayments: batchResponse.successfulPayments,
        failedPayments: batchResponse.failedPayments,
        pendingPayments: batchResponse.pendingPayments,
        processingTime,
        errors: [],
      };

    } catch (error: any) {
      console.error('❌ Monthly rent collection failed:', error);
      return this.createErrorResult('', error.message);
    }
  }

  /**
   * Retry failed payments from a previous batch
   */
  async retryFailedPayments(batchId: string): Promise<BatchProcessingResult> {
    console.log(`🔄 Retrying failed payments for batch ${batchId}`);

    try {
      // Get failed payments from the batch
      const failedPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            sql`${payments.notes} LIKE '%batch_id:${batchId}%'`,
            eq(payments.paymentStatus, 'failed')
          )
        );

      if (failedPayments.length === 0) {
        return this.createErrorResult(batchId, 'No failed payments found to retry');
      }

      // Convert to payment requests and retry
      const retryRequests = failedPayments.map(payment => ({
        phoneNumber: payment.phoneNumber || '',
        amount: payment.amount,
        reference: `RETRY-${payment.reference}`,
        description: `Retry rent payment for ${payment.month}`,
      }));

      const batchRequest: BatchPaymentRequest = {
        payments: retryRequests,
        scheduledAt: new Date(),
        priority: 'high',
        retryCount: 1,
      };

      const batchResponse = await this.unifiedPaymentService.processBatchPayments(batchRequest);
      
      console.log(`🔄 Retry completed: ${batchResponse.successfulPayments} successful, ${batchResponse.failedPayments} failed`);

      return {
        batchId: `${batchId}-retry`,
        totalTenants: failedPayments.length,
        totalAmount: retryRequests.reduce((sum, req) => sum + parseFloat(req.amount), 0).toFixed(2),
        successfulPayments: batchResponse.successfulPayments,
        failedPayments: batchResponse.failedPayments,
        pendingPayments: batchResponse.pendingPayments,
        processingTime: 0,
        errors: [],
      };

    } catch (error: any) {
      console.error('❌ Retry failed payments error:', error);
      return this.createErrorResult(batchId, error.message);
    }
  }

  /**
   * Get processing status for a batch
   */
  async getBatchStatus(batchId: string) {
    try {
      const batch = await db
        .select()
        .from(batchPayments)
        .where(eq(batchPayments.id, batchId))
        .limit(1);

      if (batch.length === 0) {
        throw new Error('Batch not found');
      }

      const batchData = batch[0];
      
      // Get associated payment records
      const paymentRecords = await db
        .select()
        .from(payments)
        .where(sql`${payments.notes} LIKE '%batch_id:${batchId}%'`);

      return {
        ...batchData,
        paymentRecords,
        completionPercentage: batchData.totalPayments > 0 
          ? (((batchData.successfulPayments || 0) + (batchData.failedPayments || 0)) / batchData.totalPayments) * 100 
          : 0,
      };
    } catch (error: any) {
      console.error('❌ Get batch status error:', error);
      throw error;
    }
  }

  private async getTenantsForRentCollection(options: MonthlyRentBatchOptions) {
    let query = db
      .select({
        tenant: tenants,
        room: rooms,
        property: properties,
      })
      .from(tenants)
      .leftJoin(rooms, eq(tenants.roomId, rooms.id))
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .where(eq(tenants.status, 'active'));

    const result = await query;

    // Apply filters
    let filteredResults = result.filter(item => {
      if (!item.room) return false; // Skip tenants without rooms
      
      const rentAmount = parseFloat(item.room.rentAmount);
      
      // Amount filters
      if (options.minAmount && rentAmount < options.minAmount) return false;
      if (options.maxAmount && rentAmount > options.maxAmount) return false;
      
      // Include/exclude filters
      if (options.includeTenantsWithIds && !options.includeTenantsWithIds.includes(item.tenant.id)) return false;
      if (options.excludeTenantsWithIds && options.excludeTenantsWithIds.includes(item.tenant.id)) return false;
      
      return true;
    });

    return filteredResults;
  }

  private createPaymentRequest(tenantData: any, options: MonthlyRentBatchOptions): PaymentRequest {
    const { tenant, room, property } = tenantData;
    
    return {
      phoneNumber: tenant.phone,
      amount: room.rentAmount,
      reference: `RENT-${options.month}-${room.roomNumber}-${Date.now()}`,
      description: `Rent payment for ${room.roomNumber} - ${options.month}`,
      accountReference: tenant.id,
      transactionDesc: `${property?.name || 'Property'} Room ${room.roomNumber} rent for ${options.month}`,
    };
  }

  private async createBatchRecord(batchType: 'monthly_rent' | 'bulk_stk', options: MonthlyRentBatchOptions) {
    const batchData = {
      batchType,
      providerId: options.providerId || 'jenga',
      totalPayments: 0, // Will be updated after processing
      status: 'pending' as const,
      scheduledAt: new Date(),
    };

    const [batch] = await db.insert(batchPayments).values(batchData).returning();
    return batch;
  }

  private async updateBatchRecord(
    batchId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string | null,
    successfulPayments?: number,
    failedPayments?: number,
    pendingPayments?: number,
    results?: any
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    if (successfulPayments !== undefined) updateData.successfulPayments = successfulPayments;
    if (failedPayments !== undefined) updateData.failedPayments = failedPayments;
    if (pendingPayments !== undefined) updateData.pendingPayments = pendingPayments;
    if (results) updateData.results = results;

    await db
      .update(batchPayments)
      .set(updateData)
      .where(eq(batchPayments.id, batchId));
  }

  private async storePaymentRecords(
    batchResponse: BatchPaymentResponse, 
    tenantData: any[], 
    options: MonthlyRentBatchOptions
  ) {
    const paymentRecords = batchResponse.results.map((result, index) => {
      const tenant = tenantData[index];
      const currentDate = new Date();
      
      return {
        tenantId: tenant.tenant.id,
        roomId: tenant.room.id,
        amount: result.success ? tenant.room.rentAmount : '0',
        paymentMethod: 'mpesa' as const,
        paymentStatus: result.status,
        paymentProvider: options.providerId || 'jenga',
        transactionId: result.transactionId,
        reference: result.reference,
        phoneNumber: tenant.tenant.phone,
        dueDate: options.dueDate,
        paidDate: result.status === 'completed' ? new Date() : null,
        month: options.month,
        year: parseInt(options.month.split('-')[0]),
        notes: `Batch payment - batch_id:${batchResponse.batchId} - ${result.message || ''}`,
        providerData: result.providerData,
      };
    });

    await db.insert(payments).values(paymentRecords);
  }

  private createErrorResult(batchId: string, errorMessage: string): BatchProcessingResult {
    return {
      batchId,
      totalTenants: 0,
      totalAmount: '0.00',
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      processingTime: 0,
      errors: [errorMessage],
    };
  }

  private createTestResult(
    batchId: string, 
    paymentRequests: PaymentRequest[], 
    totalAmount: number
  ): BatchProcessingResult {
    return {
      batchId,
      totalTenants: paymentRequests.length,
      totalAmount: totalAmount.toFixed(2),
      successfulPayments: paymentRequests.length, // Simulate success in test mode
      failedPayments: 0,
      pendingPayments: 0,
      processingTime: 0,
      errors: [],
    };
  }
}

// Singleton instance
let batchProcessor: BatchPaymentProcessor | null = null;

export function getBatchPaymentProcessor(): BatchPaymentProcessor {
  if (!batchProcessor) {
    batchProcessor = new BatchPaymentProcessor();
  }
  return batchProcessor;
}

/**
 * Convenience function to trigger monthly rent collection
 */
export async function triggerMonthlyRentCollection(
  month?: string,
  testMode = false
): Promise<BatchProcessingResult> {
  const processor = getBatchPaymentProcessor();
  
  // Default to current month if not specified
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  
  // Set due date to the 1st of the month
  const [year, monthNum] = targetMonth.split('-');
  const dueDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  
  console.log(`🚀 Triggering rent collection for ${targetMonth}, due date: ${dueDate.toDateString()}`);
  
  return await processor.processMonthlyRentCollection({
    month: targetMonth,
    dueDate,
    testMode,
  });
}