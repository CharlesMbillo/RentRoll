import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["landlord", "caretaker", "tenant"] }).notNull().default("tenant"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Properties table
export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  totalUnits: integer("total_units").notNull(),
  currency: varchar("currency").notNull().default("KSh"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rooms table
export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: uuid("property_id").references(() => properties.id).notNull(),
  roomNumber: varchar("room_number").notNull(),
  floor: integer("floor"),
  rentAmount: decimal("rent_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { enum: ["vacant", "occupied"] }).notNull().default("vacant"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tenants table
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  roomId: uuid("room_id").references(() => rooms.id),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email"),
  phone: varchar("phone").notNull(),
  nationalId: varchar("national_id"),
  emergencyContact: varchar("emergency_contact"),
  leaseStartDate: timestamp("lease_start_date"),
  leaseEndDate: timestamp("lease_end_date"),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  status: varchar("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payments table - Enhanced for multiple payment providers
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  roomId: uuid("room_id").references(() => rooms.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { 
    enum: ["mpesa", "bank_transfer", "cash", "check", "airtel_money", "tkash"] 
  }).notNull(),
  paymentStatus: varchar("payment_status", { 
    enum: ["pending", "processing", "completed", "failed", "cancelled", "refunded"] 
  }).notNull().default("pending"),
  
  // Provider information
  paymentProvider: varchar("payment_provider", { 
    enum: ["jenga", "safaricom", "coop"] 
  }).default("jenga"),
  
  // Transaction identifiers
  transactionId: varchar("transaction_id"), // Provider transaction ID
  reference: varchar("reference"), // Our internal reference
  receiptNumber: varchar("receipt_number"), // Provider receipt/confirmation
  
  // Legacy M-Pesa fields (kept for backward compatibility)
  mpesaTransactionId: varchar("mpesa_transaction_id"),
  mpesaReceiptNumber: varchar("mpesa_receipt_number"),
  
  // Safaricom-specific fields
  checkoutRequestId: varchar("checkout_request_id"),
  merchantRequestId: varchar("merchant_request_id"),
  
  // Provider-specific data
  providerData: jsonb("provider_data"),
  
  // Timing
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  month: varchar("month").notNull(), // Format: YYYY-MM
  year: integer("year").notNull(),
  
  // Additional fields
  phoneNumber: varchar("phone_number"), // Customer phone number
  failureReason: text("failure_reason"), // Failure details
  retryCount: integer("retry_count").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// SMS Notifications table
export const smsNotifications = pgTable("sms_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  message: text("message").notNull(),
  messageType: varchar("message_type", { 
    enum: ["payment_reminder", "overdue_notice", "payment_confirmation", "monthly_statement"] 
  }).notNull(),
  status: varchar("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// System Settings table
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Provider Configurations table
export const paymentProviders = pgTable("payment_providers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  providerType: varchar("provider_type", { 
    enum: ["jenga", "safaricom", "coop"] 
  }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  sandbox: boolean("sandbox").notNull().default(true),
  config: jsonb("config").notNull(), // Provider-specific configuration
  capabilities: jsonb("capabilities").notNull(), // Provider capabilities
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: varchar("health_status", { 
    enum: ["healthy", "unhealthy", "unknown"] 
  }).default("unknown"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Batch Payment Processing table
export const batchPayments = pgTable("batch_payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  batchType: varchar("batch_type", { 
    enum: ["monthly_rent", "bulk_stk", "reconciliation"] 
  }).notNull(),
  providerId: varchar("provider_id", { 
    enum: ["jenga", "safaricom", "coop"] 
  }).notNull(),
  totalPayments: integer("total_payments").notNull(),
  successfulPayments: integer("successful_payments").default(0),
  failedPayments: integer("failed_payments").default(0),
  pendingPayments: integer("pending_payments").default(0),
  status: varchar("status", { 
    enum: ["pending", "processing", "completed", "failed", "cancelled"] 
  }).notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  results: jsonb("results"), // Detailed results
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reconciliation Records table (for COOP CSV imports)
export const reconciliationRecords = pgTable("reconciliation_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id", { 
    enum: ["jenga", "safaricom", "coop"] 
  }).notNull(),
  batchId: uuid("batch_id").references(() => batchPayments.id),
  transactionId: varchar("transaction_id").notNull(),
  reference: varchar("reference"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  phoneNumber: varchar("phone_number"),
  status: varchar("status", { 
    enum: ["pending", "processing", "completed", "failed", "cancelled", "refunded"] 
  }).notNull(),
  accountNumber: varchar("account_number"),
  narration: text("narration"),
  completedAt: timestamp("completed_at").notNull(),
  matchedPaymentId: uuid("matched_payment_id").references(() => payments.id),
  reconciliationStatus: varchar("reconciliation_status", { 
    enum: ["matched", "unmatched", "discrepancy"] 
  }).notNull().default("unmatched"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  tenants: many(tenants),
}));

export const propertiesRelations = relations(properties, ({ many }) => ({
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  property: one(properties, {
    fields: [rooms.propertyId],
    references: [properties.id],
  }),
  tenants: many(tenants),
  payments: many(payments),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  user: one(users, {
    fields: [tenants.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [tenants.roomId],
    references: [rooms.id],
  }),
  payments: many(payments),
  smsNotifications: many(smsNotifications),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  room: one(rooms, {
    fields: [payments.roomId],
    references: [rooms.id],
  }),
}));

export const smsNotificationsRelations = relations(smsNotifications, ({ one }) => ({
  tenant: one(tenants, {
    fields: [smsNotifications.tenantId],
    references: [tenants.id],
  }),
}));

export const paymentProvidersRelations = relations(paymentProviders, ({ many }) => ({
  batchPayments: many(batchPayments),
}));

export const batchPaymentsRelations = relations(batchPayments, ({ one, many }) => ({
  provider: one(paymentProviders, {
    fields: [batchPayments.providerId],
    references: [paymentProviders.providerType],
  }),
  reconciliationRecords: many(reconciliationRecords),
}));

export const reconciliationRecordsRelations = relations(reconciliationRecords, ({ one }) => ({
  batch: one(batchPayments, {
    fields: [reconciliationRecords.batchId],
    references: [batchPayments.id],
  }),
  matchedPayment: one(payments, {
    fields: [reconciliationRecords.matchedPaymentId],
    references: [payments.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSmsNotificationSchema = createInsertSchema(smsNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertPaymentProviderSchema = createInsertSchema(paymentProviders).omit({
  id: true,
  lastHealthCheck: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBatchPaymentSchema = createInsertSchema(batchPayments).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReconciliationRecordSchema = createInsertSchema(reconciliationRecords).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type SmsNotification = typeof smsNotifications.$inferSelect;
export type InsertSmsNotification = z.infer<typeof insertSmsNotificationSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type PaymentProvider = typeof paymentProviders.$inferSelect;
export type InsertPaymentProvider = z.infer<typeof insertPaymentProviderSchema>;
export type BatchPayment = typeof batchPayments.$inferSelect;
export type InsertBatchPayment = z.infer<typeof insertBatchPaymentSchema>;
export type ReconciliationRecord = typeof reconciliationRecords.$inferSelect;
export type InsertReconciliationRecord = z.infer<typeof insertReconciliationRecordSchema>;
