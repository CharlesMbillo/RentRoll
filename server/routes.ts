import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertTenantSchema, insertPaymentSchema, insertRoomSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Temporary development authentication bypass
  if (process.env.NODE_ENV === 'development') {
    app.get('/api/auth/dev-login', async (req: any, res) => {
      try {
        console.log("Development login attempt");
        
        // Create a test user session
        const testUser = {
          claims: { sub: 'dev-user-123' },
          access_token: 'dev-token',
          refresh_token: 'dev-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        };
        
        // Manually set the user in session
        req.session.passport = { user: testUser };
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Session save failed" });
          }
          
          console.log("Development user session created");
          console.log("Session after save:", req.session);
          res.json({ message: "Development login successful", user: testUser });
        });
      } catch (error) {
        console.error("Error in development login:", error);
        res.status(500).json({ message: "Development login failed" });
      }
    });
  }

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Temporary bypass: return a mock user for development testing
      const mockUser = {
        id: 'dev-user-123',
        email: 'developer@rentflow.com',
        firstName: 'Developer',
        lastName: 'User',
        role: 'landlord',
        profileImageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      console.log("Returning mock user for development testing");
      res.json(mockUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard/metrics', async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Property routes
  app.get('/api/properties', async (req, res) => {
    try {
      const properties = await storage.getProperties();
      res.json(properties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  // Room routes
  app.get('/api/rooms/:propertyId', async (req, res) => {
    try {
      const { propertyId } = req.params;
      const rooms = await storage.getRoomsByProperty(propertyId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  app.post('/api/rooms', async (req, res) => {
    try {
      const roomData = insertRoomSchema.parse(req.body);
      const room = await storage.createRoom(roomData);
      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid room data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create room" });
      }
    }
  });

  // Tenant routes
  app.get('/api/tenants', async (req, res) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.get('/api/tenants/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenant = await storage.getTenant(id);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Failed to fetch tenant" });
    }
  });

  app.post('/api/tenants', async (req, res) => {
    try {
      const tenantData = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(tenantData);
      res.status(201).json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid tenant data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create tenant" });
      }
    }
  });

  app.put('/api/tenants/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const tenantData = insertTenantSchema.partial().parse(req.body);
      const tenant = await storage.updateTenant(id, tenantData);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Error updating tenant:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid tenant data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update tenant" });
      }
    }
  });

  app.delete('/api/tenants/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTenant(id);
      if (!success) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Failed to delete tenant" });
    }
  });

  // Payment routes
  app.get('/api/payments', async (req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get('/api/payments/tenant/:tenantId', async (req, res) => {
    try {
      const { tenantId } = req.params;
      const payments = await storage.getPaymentsByTenant(tenantId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching tenant payments:", error);
      res.status(500).json({ message: "Failed to fetch tenant payments" });
    }
  });

  app.post('/api/payments', async (req, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create payment" });
      }
    }
  });

  app.put('/api/payments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const paymentData = insertPaymentSchema.partial().parse(req.body);
      const payment = await storage.updatePayment(id, paymentData);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Error updating payment:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update payment" });
      }
    }
  });

  // M-Pesa STK Push
  app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
      const { phoneNumber, amount, roomId, tenantId } = req.body;
      
      // Validate required fields
      if (!phoneNumber || !amount || !roomId || !tenantId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // TODO: Implement actual M-Pesa STK Push integration
      // For now, create a pending payment record
      const currentDate = new Date();
      const month = currentDate.toISOString().slice(0, 7);
      const year = currentDate.getFullYear();

      const paymentData = {
        tenantId,
        roomId,
        amount: amount.toString(),
        paymentMethod: "mpesa" as const,
        paymentStatus: "pending" as const,
        dueDate: currentDate,
        month,
        year,
        notes: `STK Push initiated to ${phoneNumber}`,
      };

      const payment = await storage.createPayment(paymentData);
      
      res.json({
        success: true,
        message: "STK Push initiated successfully",
        paymentId: payment.id,
        // In real implementation, you would return M-Pesa response
      });
    } catch (error) {
      console.error("Error initiating STK Push:", error);
      res.status(500).json({ message: "Failed to initiate STK Push" });
    }
  });

  // SMS Notification routes
  app.get('/api/sms-notifications', async (req, res) => {
    try {
      const notifications = await storage.getSmsNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching SMS notifications:", error);
      res.status(500).json({ message: "Failed to fetch SMS notifications" });
    }
  });

  app.post('/api/sms-notifications', async (req, res) => {
    try {
      const { tenantId, phoneNumber, message, messageType } = req.body;
      
      if (!tenantId || !phoneNumber || !message || !messageType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const notification = await storage.createSmsNotification({
        tenantId,
        phoneNumber,
        message,
        messageType,
        status: "pending",
      });

      // TODO: Implement actual SMS sending logic here
      // For now, mark as sent immediately
      await storage.updateSmsNotification(notification.id, {
        status: "sent",
        sentAt: new Date(),
      });

      res.status(201).json(notification);
    } catch (error) {
      console.error("Error sending SMS notification:", error);
      res.status(500).json({ message: "Failed to send SMS notification" });
    }
  });

  // System Settings routes
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.put('/api/settings/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      
      if (!value) {
        return res.status(400).json({ message: "Value is required" });
      }

      const setting = await storage.upsertSystemSetting({
        key,
        value,
        description,
      });

      res.json(setting);
    } catch (error) {
      console.error("Error updating system setting:", error);
      res.status(500).json({ message: "Failed to update system setting" });
    }
  });

  // Database seeding endpoint (development only)
  if (process.env.NODE_ENV === 'development') {
    app.post('/api/seed', async (req, res) => {
      try {
        const { seedDatabase } = await import('./seed');
        const result = await seedDatabase();
        res.json({ message: "Database seeded successfully", data: result });
      } catch (error) {
        console.error("Error seeding database:", error);
        res.status(500).json({ message: "Failed to seed database", error: error.message });
      }
    });
  }

  const httpServer = createServer(app);
  return httpServer;
}
