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

// Payments table
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  roomId: uuid("room_id").references(() => rooms.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { enum: ["mpesa", "bank_transfer", "cash", "check"] }).notNull(),
  paymentStatus: varchar("payment_status", { enum: ["pending", "completed", "failed", "refunded"] }).notNull().default("pending"),
  mpesaTransactionId: varchar("mpesa_transaction_id"),
  mpesaReceiptNumber: varchar("mpesa_receipt_number"),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  month: varchar("month").notNull(), // Format: YYYY-MM
  year: integer("year").notNull(),
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
