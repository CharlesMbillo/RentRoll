import type {
  User,
  Property,
  Room,
  Tenant,
  Payment,
  SmsNotification,
  SystemSetting,
} from "@shared/schema";

export type {
  User,
  Property,
  Room,
  Tenant,
  Payment,
  SmsNotification,
  SystemSetting,
};

export interface DashboardMetrics {
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
}

export interface RoomWithTenant extends Room {
  tenant?: Tenant;
  paymentStatus?: "paid" | "pending" | "overdue" | "vacant";
}

export interface TenantWithRoom extends Tenant {
  room?: Room;
}

export interface PaymentWithDetails extends Payment {
  tenant?: Tenant;
  room?: Room;
}

export type UserRole = "landlord" | "caretaker" | "tenant";

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export type PaymentMethod = "mpesa" | "bank_transfer" | "cash" | "check";

export type SmsMessageType = "payment_reminder" | "overdue_notice" | "payment_confirmation" | "monthly_statement";
