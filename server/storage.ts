import {
  users,
  properties,
  rooms,
  tenants,
  payments,
  smsNotifications,
  systemSettings,
  paymentProviders,
  batchPayments,
  reconciliationRecords,
  type User,
  type UpsertUser,
  type Property,
  type InsertProperty,
  type Room,
  type InsertRoom,
  type Tenant,
  type InsertTenant,
  type Payment,
  type InsertPayment,
  type SmsNotification,
  type InsertSmsNotification,
  type SystemSetting,
  type InsertSystemSetting,
  type PaymentProvider,
  type InsertPaymentProvider,
  type BatchPayment,
  type InsertBatchPayment,
  type ReconciliationRecord,
  type InsertReconciliationRecord,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte, like, sql, count } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Property operations
  getProperties(): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<boolean>;

  // Room operations
  getRooms(): Promise<Room[]>;
  getRoomsByProperty(propertyId: string): Promise<Room[]>;
  getRoom(id: string): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, room: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;

  // Tenant operations
  getTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByRoom(roomId: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<boolean>;

  // Payment operations
  getPayments(): Promise<Payment[]>;
  getPaymentsByTenant(tenantId: string): Promise<Payment[]>;
  getPaymentsByRoom(roomId: string): Promise<Payment[]>;
  getPaymentsByMonth(month: string, year: number): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<boolean>;

  // SMS Notification operations
  getSmsNotifications(): Promise<SmsNotification[]>;
  getSmsNotificationsByTenant(tenantId: string): Promise<SmsNotification[]>;
  createSmsNotification(notification: InsertSmsNotification): Promise<SmsNotification>;
  updateSmsNotification(id: string, notification: Partial<InsertSmsNotification>): Promise<SmsNotification | undefined>;

  // System Settings operations
  getSystemSettings(): Promise<SystemSetting[]>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;

  // Payment Provider operations
  getPaymentProviders(): Promise<PaymentProvider[]>;
  getPaymentProvider(id: string): Promise<PaymentProvider | undefined>;
  getPaymentProviderByType(providerType: string): Promise<PaymentProvider | undefined>;
  createPaymentProvider(provider: InsertPaymentProvider): Promise<PaymentProvider>;
  updatePaymentProvider(id: string, provider: Partial<InsertPaymentProvider>): Promise<PaymentProvider | undefined>;
  deletePaymentProvider(id: string): Promise<boolean>;
  updateProviderHealthStatus(providerType: string, healthStatus: string, lastHealthCheck: Date): Promise<void>;

  // Batch Payment operations
  getBatchPayments(): Promise<BatchPayment[]>;
  getBatchPayment(id: string): Promise<BatchPayment | undefined>;
  createBatchPayment(batch: InsertBatchPayment): Promise<BatchPayment>;
  updateBatchPayment(id: string, batch: Partial<InsertBatchPayment>): Promise<BatchPayment | undefined>;
  deleteBatchPayment(id: string): Promise<boolean>;

  // Reconciliation Record operations
  getReconciliationRecords(): Promise<ReconciliationRecord[]>;
  getReconciliationRecord(id: string): Promise<ReconciliationRecord | undefined>;
  getReconciliationRecordsByBatch(batchId: string): Promise<ReconciliationRecord[]>;
  getReconciliationRecordsByProvider(providerId: string): Promise<ReconciliationRecord[]>;
  createReconciliationRecord(record: InsertReconciliationRecord): Promise<ReconciliationRecord>;
  updateReconciliationRecord(id: string, record: Partial<InsertReconciliationRecord>): Promise<ReconciliationRecord | undefined>;
  deleteReconciliationRecord(id: string): Promise<boolean>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    occupancyRate: number;
    monthlyRevenue: number;
    pendingPayments: number;
    overduePayments: number;
    totalUnits: number;
    occupiedUnits: number;
    roomStatusCounts: {
      paid: number;
      pending: number;
      overdue: number;
      vacant: number;
    };
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Property operations
  async getProperties(): Promise<Property[]> {
    return await db.select().from(properties).orderBy(asc(properties.name));
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const [newProperty] = await db.insert(properties).values(property).returning();
    return newProperty;
  }

  async updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined> {
    const [updatedProperty] = await db
      .update(properties)
      .set({ ...property, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    return updatedProperty;
  }

  async deleteProperty(id: string): Promise<boolean> {
    const result = await db.delete(properties).where(eq(properties.id, id));
    return result.length > 0;
  }

  // Room operations
  async getRooms(): Promise<Room[]> {
    return await db
      .select()
      .from(rooms)
      .orderBy(asc(rooms.roomNumber));
  }

  async getRoomsByProperty(propertyId: string): Promise<Room[]> {
    return await db
      .select()
      .from(rooms)
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(asc(rooms.roomNumber));
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    const [newRoom] = await db.insert(rooms).values(room).returning();
    return newRoom;
  }

  async updateRoom(id: string, room: Partial<InsertRoom>): Promise<Room | undefined> {
    const [updatedRoom] = await db
      .update(rooms)
      .set({ ...room, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();
    return updatedRoom;
  }

  async deleteRoom(id: string): Promise<boolean> {
    const result = await db.delete(rooms).where(eq(rooms.id, id));
    return result.length > 0;
  }

  // Tenant operations
  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(asc(tenants.firstName));
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByRoom(roomId: string): Promise<Tenant | undefined> {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.roomId, roomId), eq(tenants.status, "active")));
    return tenant;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    
    // Update room status to occupied if room is assigned
    if (tenant.roomId) {
      await db
        .update(rooms)
        .set({ status: "occupied", updatedAt: new Date() })
        .where(eq(rooms.id, tenant.roomId));
    }
    
    return newTenant;
  }

  async updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updatedTenant] = await db
      .update(tenants)
      .set({ ...tenant, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updatedTenant;
  }

  async deleteTenant(id: string): Promise<boolean> {
    // Get tenant before deleting to update room status
    const tenant = await this.getTenant(id);
    
    const result = await db.delete(tenants).where(eq(tenants.id, id));
    
    // Update room status to vacant if tenant had a room
    if (tenant?.roomId) {
      await db
        .update(rooms)
        .set({ status: "vacant", updatedAt: new Date() })
        .where(eq(rooms.id, tenant.roomId));
    }
    
    return result.length > 0;
  }

  // Payment operations
  async getPayments(): Promise<Payment[]> {
    return await db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getPaymentsByTenant(tenantId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt));
  }

  async getPaymentsByRoom(roomId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.roomId, roomId))
      .orderBy(desc(payments.createdAt));
  }

  async getPaymentsByMonth(month: string, year: number): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(and(eq(payments.month, month), eq(payments.year, year)))
      .orderBy(desc(payments.createdAt));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updatedPayment] = await db
      .update(payments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return updatedPayment;
  }

  async deletePayment(id: string): Promise<boolean> {
    const result = await db.delete(payments).where(eq(payments.id, id));
    return result.length > 0;
  }

  // SMS Notification operations
  async getSmsNotifications(): Promise<SmsNotification[]> {
    return await db.select().from(smsNotifications).orderBy(desc(smsNotifications.createdAt));
  }

  async getSmsNotificationsByTenant(tenantId: string): Promise<SmsNotification[]> {
    return await db
      .select()
      .from(smsNotifications)
      .where(eq(smsNotifications.tenantId, tenantId))
      .orderBy(desc(smsNotifications.createdAt));
  }

  async createSmsNotification(notification: InsertSmsNotification): Promise<SmsNotification> {
    const [newNotification] = await db.insert(smsNotifications).values(notification).returning();
    return newNotification;
  }

  async updateSmsNotification(
    id: string,
    notification: Partial<InsertSmsNotification>
  ): Promise<SmsNotification | undefined> {
    const [updatedNotification] = await db
      .update(smsNotifications)
      .set(notification)
      .where(eq(smsNotifications.id, id))
      .returning();
    return updatedNotification;
  }

  // System Settings operations
  async getSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings).orderBy(asc(systemSettings.key));
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting;
  }

  async upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const [upsertedSetting] = await db
      .insert(systemSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: setting.value,
          description: setting.description,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upsertedSetting;
  }

  // Dashboard metrics
  async getDashboardMetrics() {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentYear = new Date().getFullYear();
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Get total and occupied units
    const [totalUnitsResult] = await db.select({ count: count() }).from(rooms);
    const [occupiedUnitsResult] = await db
      .select({ count: count() })
      .from(rooms)
      .where(eq(rooms.status, "occupied"));

    const totalUnits = totalUnitsResult.count;
    const occupiedUnits = occupiedUnitsResult.count;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    // Get monthly revenue (completed payments for current month)
    const [monthlyRevenueResult] = await db
      .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.month, currentMonth),
          eq(payments.paymentStatus, "completed")
        )
      );

    const monthlyRevenue = monthlyRevenueResult.sum || 0;

    // Get pending payments (due within 3 days)
    const [pendingPaymentsResult] = await db
      .select({ count: count() })
      .from(payments)
      .where(
        and(
          eq(payments.paymentStatus, "pending"),
          lte(payments.dueDate, threeDaysFromNow),
          gte(payments.dueDate, now)
        )
      );

    // Get overdue payments
    const [overduePaymentsResult] = await db
      .select({ count: count() })
      .from(payments)
      .where(
        and(
          eq(payments.paymentStatus, "pending"),
          lte(payments.dueDate, now)
        )
      );

    // Room status counts (simplified for this implementation)
    const [paidRoomsResult] = await db
      .select({ count: count() })
      .from(payments)
      .innerJoin(rooms, eq(payments.roomId, rooms.id))
      .where(
        and(
          eq(payments.month, currentMonth),
          eq(payments.paymentStatus, "completed")
        )
      );

    const [pendingRoomsResult] = await db
      .select({ count: count() })
      .from(payments)
      .innerJoin(rooms, eq(payments.roomId, rooms.id))
      .where(
        and(
          eq(payments.month, currentMonth),
          eq(payments.paymentStatus, "pending"),
          gte(payments.dueDate, now)
        )
      );

    const [overdueRoomsResult] = await db
      .select({ count: count() })
      .from(payments)
      .innerJoin(rooms, eq(payments.roomId, rooms.id))
      .where(
        and(
          eq(payments.month, currentMonth),
          eq(payments.paymentStatus, "pending"),
          lte(payments.dueDate, now)
        )
      );

    const vacantRooms = totalUnits - occupiedUnits;

    return {
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      monthlyRevenue,
      pendingPayments: pendingPaymentsResult.count,
      overduePayments: overduePaymentsResult.count,
      totalUnits,
      occupiedUnits,
      roomStatusCounts: {
        paid: paidRoomsResult.count,
        pending: pendingRoomsResult.count,
        overdue: overdueRoomsResult.count,
        vacant: vacantRooms,
      },
    };
  }

  // Payment Provider operations
  async getPaymentProviders(): Promise<PaymentProvider[]> {
    return await db.select().from(paymentProviders).orderBy(asc(paymentProviders.providerType));
  }

  async getPaymentProvider(id: string): Promise<PaymentProvider | undefined> {
    const [provider] = await db.select().from(paymentProviders).where(eq(paymentProviders.id, id));
    return provider;
  }

  async getPaymentProviderByType(providerType: string): Promise<PaymentProvider | undefined> {
    const [provider] = await db.select().from(paymentProviders).where(eq(paymentProviders.providerType, providerType as any));
    return provider;
  }

  async createPaymentProvider(provider: InsertPaymentProvider): Promise<PaymentProvider> {
    const [newProvider] = await db.insert(paymentProviders).values(provider).returning();
    return newProvider;
  }

  async updatePaymentProvider(id: string, provider: Partial<InsertPaymentProvider>): Promise<PaymentProvider | undefined> {
    const [updatedProvider] = await db
      .update(paymentProviders)
      .set({ ...provider, updatedAt: new Date() })
      .where(eq(paymentProviders.id, id))
      .returning();
    return updatedProvider;
  }

  async deletePaymentProvider(id: string): Promise<boolean> {
    const result = await db.delete(paymentProviders).where(eq(paymentProviders.id, id));
    return result.length > 0;
  }

  async updateProviderHealthStatus(providerType: string, healthStatus: string, lastHealthCheck: Date): Promise<void> {
    await db
      .update(paymentProviders)
      .set({ 
        healthStatus: healthStatus as "healthy" | "unhealthy" | "unknown",
        lastHealthCheck,
        updatedAt: new Date()
      })
      .where(eq(paymentProviders.providerType, providerType as any));
  }

  // Batch Payment operations
  async getBatchPayments(): Promise<BatchPayment[]> {
    return await db.select().from(batchPayments).orderBy(desc(batchPayments.createdAt));
  }

  async getBatchPayment(id: string): Promise<BatchPayment | undefined> {
    const [batch] = await db.select().from(batchPayments).where(eq(batchPayments.id, id));
    return batch;
  }

  async createBatchPayment(batch: InsertBatchPayment): Promise<BatchPayment> {
    const [newBatch] = await db.insert(batchPayments).values(batch).returning();
    return newBatch;
  }

  async updateBatchPayment(id: string, batch: Partial<InsertBatchPayment>): Promise<BatchPayment | undefined> {
    const [updatedBatch] = await db
      .update(batchPayments)
      .set({ ...batch, updatedAt: new Date() })
      .where(eq(batchPayments.id, id))
      .returning();
    return updatedBatch;
  }

  async deleteBatchPayment(id: string): Promise<boolean> {
    const result = await db.delete(batchPayments).where(eq(batchPayments.id, id));
    return result.length > 0;
  }

  // Reconciliation Record operations
  async getReconciliationRecords(): Promise<ReconciliationRecord[]> {
    return await db.select().from(reconciliationRecords).orderBy(desc(reconciliationRecords.createdAt));
  }

  async getReconciliationRecord(id: string): Promise<ReconciliationRecord | undefined> {
    const [record] = await db.select().from(reconciliationRecords).where(eq(reconciliationRecords.id, id));
    return record;
  }

  async getReconciliationRecordsByBatch(batchId: string): Promise<ReconciliationRecord[]> {
    return await db
      .select()
      .from(reconciliationRecords)
      .where(eq(reconciliationRecords.batchId, batchId))
      .orderBy(desc(reconciliationRecords.createdAt));
  }

  async getReconciliationRecordsByProvider(providerId: string): Promise<ReconciliationRecord[]> {
    return await db
      .select()
      .from(reconciliationRecords)
      .where(eq(reconciliationRecords.providerId, providerId as any))
      .orderBy(desc(reconciliationRecords.createdAt));
  }

  async createReconciliationRecord(record: InsertReconciliationRecord): Promise<ReconciliationRecord> {
    const [newRecord] = await db.insert(reconciliationRecords).values(record).returning();
    return newRecord;
  }

  async updateReconciliationRecord(id: string, record: Partial<InsertReconciliationRecord>): Promise<ReconciliationRecord | undefined> {
    const [updatedRecord] = await db
      .update(reconciliationRecords)
      .set(record)
      .where(eq(reconciliationRecords.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteReconciliationRecord(id: string): Promise<boolean> {
    const result = await db.delete(reconciliationRecords).where(eq(reconciliationRecords.id, id));
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
