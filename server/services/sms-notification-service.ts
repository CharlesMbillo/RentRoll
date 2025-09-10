/**
 * SMS Notification Service
 * Handles SMS receipt generation and notification system per unified rent collection checklist
 */

import { db } from '../db';
import { smsNotifications, payments, tenants, rooms } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { validateAndFormatKenyanPhone } from './phone-validation';

export interface SMSConfig {
  enabled: boolean;
  provider: 'africastalking' | 'twilio' | 'textmagic';
  apiKey: string;
  username?: string;
  senderId?: string;
  sandbox: boolean;
}

export interface SMSTemplate {
  paymentReceipt: string;
  paymentReminder: string;
  overdueNotice: string;
  monthlyStatement: string;
}

export interface SMSNotificationRequest {
  tenantId: string;
  phoneNumber: string;
  messageType: 'payment_reminder' | 'overdue_notice' | 'payment_confirmation' | 'monthly_statement';
  templateData: Record<string, any>;
}

export class SMSNotificationService {
  private config: SMSConfig;
  private templates: SMSTemplate;

  constructor() {
    this.config = {
      enabled: process.env.SMS_ENABLED === 'true',
      provider: (process.env.SMS_PROVIDER as any) || 'africastalking',
      apiKey: process.env.SMS_API_KEY || '',
      username: process.env.SMS_USERNAME || '',
      senderId: process.env.SMS_SENDER_ID || 'RentFlow',
      sandbox: process.env.NODE_ENV !== 'production',
    };

    this.templates = {
      paymentReceipt: `✅ RENT PAYMENT RECEIVED
Amount: KSh {amount}
Room: {roomNumber}
Reference: {reference}
Date: {date}
Thank you for your payment!
- RentFlow Management`,

      paymentReminder: `🏠 RENT REMINDER
Dear {tenantName},
Rent of KSh {amount} for room {roomNumber} is due on {dueDate}.
Pay via M-Pesa: {paybill}
Reference: {reference}
- RentFlow Management`,

      overdueNotice: `⚠️ RENT OVERDUE
Dear {tenantName},
Your rent of KSh {amount} for room {roomNumber} is {daysPastDue} days overdue.
Please pay immediately to avoid further action.
Pay via M-Pesa: {paybill}
Reference: {reference}
- RentFlow Management`,

      monthlyStatement: `📋 MONTHLY STATEMENT
Dear {tenantName},
Room {roomNumber} - {month}
Rent Due: KSh {rentAmount}
Paid: KSh {paidAmount}
Balance: KSh {balance}
- RentFlow Management`,
    };
  }

  /**
   * Send payment receipt SMS immediately after successful payment
   */
  async sendPaymentReceipt(paymentId: string): Promise<boolean> {
    try {
      // Get payment details with tenant and room info
      const paymentData = await db
        .select({
          payment: payments,
          tenant: tenants,
          room: rooms,
        })
        .from(payments)
        .leftJoin(tenants, eq(payments.tenantId, tenants.id))
        .leftJoin(rooms, eq(payments.roomId, rooms.id))
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (paymentData.length === 0) {
        throw new Error('Payment not found');
      }

      const { payment, tenant, room } = paymentData[0];

      if (!tenant || !room) {
        throw new Error('Tenant or room data missing');
      }

      // Validate phone number
      let validatedPhone: string;
      try {
        validatedPhone = validateAndFormatKenyanPhone(tenant.phone);
      } catch (error: any) {
        console.error(`❌ Invalid phone number for tenant ${tenant.id}: ${tenant.phone}`, error.message);
        return false;
      }

      // Generate receipt message
      const message = this.templates.paymentReceipt
        .replace('{amount}', parseFloat(payment.amount).toLocaleString())
        .replace('{roomNumber}', room.roomNumber)
        .replace('{reference}', payment.reference || '')
        .replace('{date}', payment.paidDate?.toLocaleDateString() || new Date().toLocaleDateString());

      // Send SMS
      const success = await this.sendSMS({
        tenantId: tenant.id,
        phoneNumber: validatedPhone,
        messageType: 'payment_confirmation',
        templateData: {
          amount: payment.amount,
          roomNumber: room.roomNumber,
          reference: payment.reference,
          date: payment.paidDate,
        },
      }, message);

      if (success) {
        console.log(`✅ Payment receipt sent to ${validatedPhone} for payment ${paymentId}`);
      }

      return success;

    } catch (error: any) {
      console.error('❌ Failed to send payment receipt:', error);
      return false;
    }
  }

  /**
   * Send rent reminder SMS (7 days before due date)
   */
  async sendRentReminder(tenantId: string, dueDate: Date): Promise<boolean> {
    try {
      // Get tenant and room info
      const tenantData = await db
        .select({
          tenant: tenants,
          room: rooms,
        })
        .from(tenants)
        .leftJoin(rooms, eq(tenants.roomId, rooms.id))
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (tenantData.length === 0 || !tenantData[0].room) {
        throw new Error('Tenant or room not found');
      }

      const { tenant, room } = tenantData[0];

      // Validate phone number
      const validatedPhone = validateAndFormatKenyanPhone(tenant.phone);

      // Generate reminder message
      const message = this.templates.paymentReminder
        .replace('{tenantName}', `${tenant.firstName} ${tenant.lastName}`)
        .replace('{amount}', parseFloat(room.rentAmount).toLocaleString())
        .replace('{roomNumber}', room.roomNumber)
        .replace('{dueDate}', dueDate.toLocaleDateString())
        .replace('{paybill}', process.env.MPESA_PAYBILL || 'XXXX')
        .replace('{reference}', `Rent-${new Date().toISOString().slice(0, 7)}-${room.roomNumber}`);

      return await this.sendSMS({
        tenantId: tenant.id,
        phoneNumber: validatedPhone,
        messageType: 'payment_reminder',
        templateData: {
          tenantName: `${tenant.firstName} ${tenant.lastName}`,
          amount: room.rentAmount,
          roomNumber: room.roomNumber,
          dueDate: dueDate.toISOString(),
        },
      }, message);

    } catch (error: any) {
      console.error('❌ Failed to send rent reminder:', error);
      return false;
    }
  }

  /**
   * Send overdue notice (7+ days after due date)
   */
  async sendOverdueNotice(tenantId: string, daysPastDue: number): Promise<boolean> {
    try {
      // Get tenant and room info
      const tenantData = await db
        .select({
          tenant: tenants,
          room: rooms,
        })
        .from(tenants)
        .leftJoin(rooms, eq(tenants.roomId, rooms.id))
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (tenantData.length === 0 || !tenantData[0].room) {
        throw new Error('Tenant or room not found');
      }

      const { tenant, room } = tenantData[0];

      // Validate phone number
      const validatedPhone = validateAndFormatKenyanPhone(tenant.phone);

      // Generate overdue message
      const message = this.templates.overdueNotice
        .replace('{tenantName}', `${tenant.firstName} ${tenant.lastName}`)
        .replace('{amount}', parseFloat(room.rentAmount).toLocaleString())
        .replace('{roomNumber}', room.roomNumber)
        .replace('{daysPastDue}', daysPastDue.toString())
        .replace('{paybill}', process.env.MPESA_PAYBILL || 'XXXX')
        .replace('{reference}', `Rent-${new Date().toISOString().slice(0, 7)}-${room.roomNumber}`);

      return await this.sendSMS({
        tenantId: tenant.id,
        phoneNumber: validatedPhone,
        messageType: 'overdue_notice',
        templateData: {
          tenantName: `${tenant.firstName} ${tenant.lastName}`,
          amount: room.rentAmount,
          roomNumber: room.roomNumber,
          daysPastDue,
        },
      }, message);

    } catch (error: any) {
      console.error('❌ Failed to send overdue notice:', error);
      return false;
    }
  }

  /**
   * Core SMS sending function
   */
  private async sendSMS(request: SMSNotificationRequest, message: string): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('📱 SMS disabled - would send:', message);
      return true; // Return true in test mode
    }

    try {
      // Store SMS record in database
      const [smsRecord] = await db.insert(smsNotifications).values({
        tenantId: request.tenantId,
        phoneNumber: request.phoneNumber,
        message,
        messageType: request.messageType,
        status: 'pending',
      }).returning();

      // Send via configured provider
      let success = false;
      
      switch (this.config.provider) {
        case 'africastalking':
          success = await this.sendViaAfricasTalking(request.phoneNumber, message);
          break;
        case 'twilio':
          success = await this.sendViaTwilio(request.phoneNumber, message);
          break;
        case 'textmagic':
          success = await this.sendViaTextMagic(request.phoneNumber, message);
          break;
        default:
          console.log(`📱 SMS Provider ${this.config.provider} - Message: ${message}`);
          success = true; // Simulate success for testing
      }

      // Update SMS record status
      await db.update(smsNotifications)
        .set({
          status: success ? 'sent' : 'failed',
          sentAt: success ? new Date() : undefined,
          errorMessage: success ? undefined : 'Failed to send SMS',
        })
        .where(eq(smsNotifications.id, smsRecord.id));

      return success;

    } catch (error: any) {
      console.error('❌ SMS sending error:', error);
      return false;
    }
  }

  /**
   * Send SMS via Africa's Talking
   */
  private async sendViaAfricasTalking(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // TODO: Implement Africa's Talking API integration
      console.log(`📱 [AfricasTalking] To: ${phoneNumber}, Message: ${message}`);
      return true; // Placeholder
    } catch (error: any) {
      console.error('❌ Africa\'s Talking SMS error:', error);
      return false;
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendViaTwilio(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // TODO: Implement Twilio API integration
      console.log(`📱 [Twilio] To: ${phoneNumber}, Message: ${message}`);
      return true; // Placeholder
    } catch (error: any) {
      console.error('❌ Twilio SMS error:', error);
      return false;
    }
  }

  /**
   * Send SMS via TextMagic
   */
  private async sendViaTextMagic(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // TODO: Implement TextMagic API integration
      console.log(`📱 [TextMagic] To: ${phoneNumber}, Message: ${message}`);
      return true; // Placeholder
    } catch (error: any) {
      console.error('❌ TextMagic SMS error:', error);
      return false;
    }
  }

  /**
   * Get SMS history for a tenant
   */
  async getSMSHistory(tenantId: string, limit = 50) {
    return await db
      .select()
      .from(smsNotifications)
      .where(eq(smsNotifications.tenantId, tenantId))
      .orderBy(desc(smsNotifications.createdAt))
      .limit(limit);
  }

  /**
   * Update SMS configuration
   */
  updateConfig(newConfig: Partial<SMSConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('📱 SMS config updated:', this.config);
  }

  /**
   * Get SMS service status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      provider: this.config.provider,
      configValid: !!(this.config.apiKey && this.config.username),
    };
  }
}

// Singleton instance
let smsService: SMSNotificationService | null = null;

export function getSMSNotificationService(): SMSNotificationService {
  if (!smsService) {
    smsService = new SMSNotificationService();
  }
  return smsService;
}