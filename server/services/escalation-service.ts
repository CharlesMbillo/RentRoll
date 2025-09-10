/**
 * Escalation Service
 * Handles automated rent collection escalations per unified rent collection checklist:
 * - 7 days: Send reminder SMS to tenant
 * - 14 days: Escalate to caretaker notification
 */

import { db } from '../db';
import { payments, tenants, rooms, users } from '@shared/schema';
import { eq, and, lt, isNull, sql } from 'drizzle-orm';
import { getSMSNotificationService } from './sms-notification-service';

export interface EscalationConfig {
  enabled: boolean;
  reminderDays: number; // Days after due date to send reminder (default: 7)
  escalationDays: number; // Days after due date to escalate to caretaker (default: 14)
  checkIntervalHours: number; // How often to check for escalations (default: 24)
}

export interface EscalationCase {
  tenantId: string;
  roomId: string;
  paymentId: string;
  tenantName: string;
  roomNumber: string;
  rentAmount: string;
  dueDate: Date;
  daysPastDue: number;
  escalationLevel: 'reminder' | 'caretaker' | 'final';
  lastAction?: Date;
}

export class EscalationService {
  private config: EscalationConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private smsService = getSMSNotificationService();

  constructor(config: EscalationConfig = {
    enabled: true,
    reminderDays: 7,
    escalationDays: 14,
    checkIntervalHours: 24,
  }) {
    this.config = config;
  }

  /**
   * Start the escalation monitoring service
   */
  start() {
    if (this.intervalId) {
      console.log('⚠️ Escalation service is already running');
      return;
    }

    console.log(`⚠️ Starting escalation service - checks every ${this.config.checkIntervalHours}h`);
    
    // Check immediately on start
    this.processEscalations().catch(console.error);
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.processEscalations().catch(console.error);
    }, this.config.checkIntervalHours * 60 * 60 * 1000); // Convert hours to milliseconds
  }

  /**
   * Stop the escalation monitoring service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('⚠️ Escalation service stopped');
  }

  /**
   * Process all escalations
   */
  async processEscalations(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log('🔍 Checking for rent payment escalations...');

    try {
      const escalationCases = await this.getEscalationCases();
      
      if (escalationCases.length === 0) {
        console.log('✅ No escalations needed');
        return;
      }

      console.log(`⚠️ Found ${escalationCases.length} cases requiring escalation`);

      for (const escalationCase of escalationCases) {
        await this.processEscalationCase(escalationCase);
        
        // Add delay between processing to avoid overwhelming SMS service
        await this.delay(1000); // 1 second delay
      }

      console.log('✅ Escalation processing completed');

    } catch (error: any) {
      console.error('❌ Escalation processing failed:', error);
    }
  }

  /**
   * Get all cases that need escalation
   */
  private async getEscalationCases(): Promise<EscalationCase[]> {
    const currentDate = new Date();
    
    // Find unpaid rents past due date
    const overduePayments = await db
      .select({
        payment: payments,
        tenant: tenants,
        room: rooms,
      })
      .from(payments)
      .leftJoin(tenants, eq(payments.tenantId, tenants.id))
      .leftJoin(rooms, eq(payments.roomId, rooms.id))
      .where(
        and(
          eq(payments.paymentStatus, 'pending'),
          lt(payments.dueDate, currentDate),
          isNull(payments.paidDate)
        )
      );

    const escalationCases: EscalationCase[] = [];

    for (const { payment, tenant, room } of overduePayments) {
      if (!tenant || !room) continue;

      const daysPastDue = Math.floor(
        (currentDate.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Skip if not yet time for any escalation
      if (daysPastDue < this.config.reminderDays) {
        continue;
      }

      let escalationLevel: 'reminder' | 'caretaker' | 'final';
      
      if (daysPastDue >= this.config.escalationDays) {
        escalationLevel = 'caretaker';
      } else if (daysPastDue >= this.config.reminderDays) {
        escalationLevel = 'reminder';
      } else {
        continue; // Not yet time for escalation
      }

      escalationCases.push({
        tenantId: tenant.id,
        roomId: room.id,
        paymentId: payment.id,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        roomNumber: room.roomNumber,
        rentAmount: payment.amount,
        dueDate: payment.dueDate,
        daysPastDue,
        escalationLevel,
      });
    }

    return escalationCases;
  }

  /**
   * Process a specific escalation case
   */
  private async processEscalationCase(escalationCase: EscalationCase): Promise<void> {
    console.log(`⚠️ Processing escalation: ${escalationCase.tenantName} - Room ${escalationCase.roomNumber} (${escalationCase.daysPastDue} days overdue)`);

    try {
      switch (escalationCase.escalationLevel) {
        case 'reminder':
          await this.sendTenantReminder(escalationCase);
          break;
        case 'caretaker':
          await this.escalateToCaretaker(escalationCase);
          break;
        case 'final':
          await this.finalEscalation(escalationCase);
          break;
      }

      // Log the escalation action in payment notes
      await this.logEscalationAction(escalationCase);

    } catch (error: any) {
      console.error(`❌ Failed to process escalation for ${escalationCase.tenantName}:`, error);
    }
  }

  /**
   * Send reminder SMS to tenant (7+ days overdue)
   */
  private async sendTenantReminder(escalationCase: EscalationCase): Promise<void> {
    console.log(`📱 Sending overdue reminder to ${escalationCase.tenantName}`);

    const success = await this.smsService.sendOverdueNotice(
      escalationCase.tenantId,
      escalationCase.daysPastDue
    );

    if (success) {
      console.log(`✅ Reminder sent to ${escalationCase.tenantName}`);
    } else {
      console.error(`❌ Failed to send reminder to ${escalationCase.tenantName}`);
    }
  }

  /**
   * Escalate to caretaker (14+ days overdue)
   */
  private async escalateToCaretaker(escalationCase: EscalationCase): Promise<void> {
    console.log(`🚨 Escalating to caretaker: ${escalationCase.tenantName} - ${escalationCase.daysPastDue} days overdue`);

    try {
      // Get caretakers
      const caretakers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'caretaker'));

      if (caretakers.length === 0) {
        console.warn('⚠️ No caretakers found for escalation');
        return;
      }

      // Send SMS to all caretakers
      for (const caretaker of caretakers) {
        if (caretaker.email) {
          await this.sendCaretakerNotification(caretaker, escalationCase);
        }
      }

      // Also send final notice to tenant
      await this.sendFinalNoticeToTenant(escalationCase);

    } catch (error: any) {
      console.error('❌ Failed to escalate to caretaker:', error);
    }
  }

  /**
   * Send notification to caretaker
   */
  private async sendCaretakerNotification(caretaker: any, escalationCase: EscalationCase): Promise<void> {
    const message = `🚨 RENT ESCALATION ALERT
Tenant: ${escalationCase.tenantName}
Room: ${escalationCase.roomNumber}
Amount: KSh ${parseFloat(escalationCase.rentAmount).toLocaleString()}
Days Overdue: ${escalationCase.daysPastDue}
Due Date: ${escalationCase.dueDate.toLocaleDateString()}

Please follow up immediately.
- RentFlow Management`;

    // TODO: Implement email/SMS notification to caretaker
    // For now, log the notification
    console.log(`📧 [CARETAKER ALERT] To: ${caretaker.email}\n${message}`);
  }

  /**
   * Send final notice to tenant
   */
  private async sendFinalNoticeToTenant(escalationCase: EscalationCase): Promise<void> {
    const message = `🚨 FINAL NOTICE
Dear ${escalationCase.tenantName},

Your rent payment of KSh ${parseFloat(escalationCase.rentAmount).toLocaleString()} for room ${escalationCase.roomNumber} is ${escalationCase.daysPastDue} days overdue.

This matter has been escalated to management. Please pay immediately to avoid eviction proceedings.

Pay via M-Pesa: ${process.env.MPESA_PAYBILL || 'XXXX'}
Reference: Rent-${new Date().toISOString().slice(0, 7)}-${escalationCase.roomNumber}

- RentFlow Management`;

    // TODO: Send via SMS service
    console.log(`📱 [FINAL NOTICE] To: ${escalationCase.tenantName}\n${message}`);
  }

  /**
   * Final escalation actions (could be legal notice, etc.)
   */
  private async finalEscalation(escalationCase: EscalationCase): Promise<void> {
    console.log(`🚨 FINAL ESCALATION: ${escalationCase.tenantName} - ${escalationCase.daysPastDue} days overdue`);
    
    // TODO: Implement final escalation actions
    // This could include:
    // - Legal notice generation
    // - Landlord notification
    // - Case management system integration
    
    console.log(`📋 Case ${escalationCase.paymentId} flagged for final action`);
  }

  /**
   * Log escalation action in payment notes
   */
  private async logEscalationAction(escalationCase: EscalationCase): Promise<void> {
    const actionNote = `Escalation ${escalationCase.escalationLevel} - ${escalationCase.daysPastDue} days overdue - ${new Date().toISOString()}`;
    
    try {
      // Get current notes
      const currentPayment = await db
        .select({ notes: payments.notes })
        .from(payments)
        .where(eq(payments.id, escalationCase.paymentId))
        .limit(1);

      const currentNotes = currentPayment[0]?.notes || '';
      const updatedNotes = currentNotes ? `${currentNotes}\n${actionNote}` : actionNote;

      // Update payment notes
      await db
        .update(payments)
        .set({ notes: updatedNotes })
        .where(eq(payments.id, escalationCase.paymentId));

    } catch (error: any) {
      console.error('❌ Failed to log escalation action:', error);
    }
  }

  /**
   * Manually trigger escalation check
   */
  async manualEscalationCheck(): Promise<EscalationCase[]> {
    console.log('🔍 Manual escalation check triggered');
    const cases = await this.getEscalationCases();
    
    for (const escalationCase of cases) {
      await this.processEscalationCase(escalationCase);
    }
    
    return cases;
  }

  /**
   * Get escalation statistics
   */
  async getEscalationStats() {
    const cases = await this.getEscalationCases();
    
    const stats = {
      totalCases: cases.length,
      reminderLevel: cases.filter(c => c.escalationLevel === 'reminder').length,
      caretakerLevel: cases.filter(c => c.escalationLevel === 'caretaker').length,
      finalLevel: cases.filter(c => c.escalationLevel === 'final').length,
      averageDaysOverdue: cases.length > 0 
        ? Math.round(cases.reduce((sum, c) => sum + c.daysPastDue, 0) / cases.length)
        : 0,
    };

    return { stats, cases };
  }

  /**
   * Update escalation configuration
   */
  updateConfig(newConfig: Partial<EscalationConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚠️ Escalation config updated:', this.config);
    
    // Restart if running to apply new config
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get escalation service status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      running: this.intervalId !== null,
      config: this.config,
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let escalationService: EscalationService | null = null;

export function getEscalationService(): EscalationService {
  if (!escalationService) {
    escalationService = new EscalationService();
  }
  return escalationService;
}

/**
 * Initialize and start the escalation service
 */
export function initializeEscalationService(config?: Partial<EscalationConfig>) {
  const service = getEscalationService();
  
  if (config) {
    service.updateConfig(config);
  }
  
  service.start();
  return service;
}