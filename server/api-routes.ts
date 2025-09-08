import { HttpRouter, HttpRequest, HttpResponse } from './http-router';
import { storage } from './storage';
import { insertTenantSchema, insertPaymentSchema, insertRoomSchema } from '@shared/schema';
import { z } from 'zod';
import { sessionManager } from './session-manager';

export async function setupApiRoutes(router: HttpRouter): Promise<void> {
  
  // Temporary development authentication bypass
  if (process.env.NODE_ENV === 'development') {
    router.get('/api/auth/dev-login', async (req: HttpRequest, res: HttpResponse) => {
      try {
        console.log("Development login attempt");
        
        const testUser = {
          claims: { sub: 'dev-user-123' },
          access_token: 'dev-token',
          refresh_token: 'dev-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600
        };
        
        res.json({ message: "Development login successful", user: testUser });
      } catch (error) {
        console.error("Error in development login:", error);
        res.status(500).json({ message: "Development login failed" });
      }
    });

    // Development logout endpoint
    router.get('/api/logout', async (req: HttpRequest, res: HttpResponse) => {
      try {
        console.log("🔐 LOGOUT REQUEST");
        
        // Destroy session if exists
        const sessionId = req.query?.sessionId as string;
        if (sessionId) {
          sessionManager.destroySession(sessionId);
        }
        
        // Set redirect headers manually
        res.status(302);
        res.setHeader('Location', '/');
        res.end();
      } catch (error) {
        console.error("Error in development logout:", error);
        res.status(500).json({ message: "Logout failed" });
      }
    });

    // Development login endpoint - redirects to landing page
    router.get('/api/login', async (req: HttpRequest, res: HttpResponse) => {
      try {
        console.log("🔐 LOGIN REQUEST - REDIRECTING TO LANDING PAGE");
        // Set redirect headers manually
        res.status(302);
        res.setHeader('Location', '/');
        res.end();
      } catch (error) {
        console.error("Error in development login:", error);
        res.status(500).json({ message: "Login failed" });
      }
    });
  }

  // Auth routes
  router.get('/api/auth/user', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const roleParam = req.query?.role as string;
      const sessionId = req.query?.sessionId as string;
      
      console.log(`🔐 AUTH REQUEST: role=${roleParam}, sessionId=${sessionId}`);
      
      // Check if there's an existing valid session
      if (sessionId) {
        const user = sessionManager.getUserFromSession(sessionId);
        if (user) {
          console.log(`✅ VALID SESSION: ${sessionId} (${user.role}: ${user.firstName} ${user.lastName})`);
          return res.json({
            ...user,
            sessionId: sessionId
          });
        } else {
          console.log(`❌ INVALID SESSION: ${sessionId}`);
        }
      }

      // If role parameter provided, create new session with that role
      if (roleParam && ['landlord', 'caretaker', 'tenant'].includes(roleParam)) {
        const session = sessionManager.createSession(roleParam as 'landlord' | 'caretaker' | 'tenant');
        const user = sessionManager.getUserFromSession(session.id);
        
        console.log(`🔐 NEW SESSION CREATED: ${session.id} for ${roleParam.toUpperCase()}`);
        return res.json({
          ...user,
          sessionId: session.id
        });
      }

      // No valid session or role parameter - return unauthorized
      console.log("❌ NO VALID SESSION OR ROLE - UNAUTHORIZED");
      return res.status(401).json({ message: "Unauthorized" });
      
    } catch (error) {
      console.error("Error in auth/user:", error);
      res.status(500).json({ message: "Failed to authenticate user" });
    }
  });

  // Dashboard metrics
  router.get('/api/dashboard/metrics', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Properties routes
  router.get('/api/properties', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const properties = await storage.getProperties();
      res.json(properties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  router.get('/api/properties/:id', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { id } = req.params!;
      const property = await storage.getProperty(id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  // Rooms routes
  router.get('/api/rooms/:propertyId', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { propertyId } = req.params!;
      const rooms = await storage.getRoomsByProperty(propertyId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  router.get('/api/rooms/room/:id', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { id } = req.params!;
      const room = await storage.getRoom(id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  router.post('/api/rooms', async (req: HttpRequest, res: HttpResponse) => {
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

  // Tenants routes
  router.get('/api/tenants', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  router.get('/api/tenants/:id', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { id } = req.params!;
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

  router.post('/api/tenants', async (req: HttpRequest, res: HttpResponse) => {
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

  router.put('/api/tenants/:id', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { id } = req.params!;
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

  router.delete('/api/tenants/:id', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { id } = req.params!;
      const success = await storage.deleteTenant(id);
      if (!success) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      res.json({ message: "Tenant deleted successfully" });
    } catch (error) {
      console.error("Error deleting tenant:", error);
      res.status(500).json({ message: "Failed to delete tenant" });
    }
  });

  // Payments routes
  router.get('/api/payments', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  router.get('/api/payments/:id', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { id } = req.params!;
      const payment = await storage.getPayment(id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Error fetching payment:", error);
      res.status(500).json({ message: "Failed to fetch payment" });
    }
  });

  router.post('/api/payments', async (req: HttpRequest, res: HttpResponse) => {
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

  router.put('/api/payments/:id', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { id } = req.params!;
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

  // JengaAPI M-Pesa STK Push
  router.post('/api/mpesa/stk-push', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { phoneNumber, amount, roomId, tenantId } = req.body;
      
      if (!phoneNumber || !amount || !tenantId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const tenant = await storage.getTenant(tenantId);
      const room = roomId ? await storage.getRoom(roomId) : null;

      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const currentDate = new Date();
      const month = currentDate.toISOString().slice(0, 7);
      const year = currentDate.getFullYear();
      const reference = `RENT-${roomId || 'PAYMENT'}-${Date.now()}`;

      const paymentData = {
        tenantId,
        roomId: roomId || null,
        amount: amount.toString(),
        paymentMethod: "mpesa" as const,
        paymentStatus: "pending" as const,
        dueDate: currentDate,
        month,
        year,
        notes: `STK Push initiated to ${phoneNumber} for ${tenant.firstName} ${tenant.lastName}`,
      };

      const payment = await storage.createPayment(paymentData);

      if (process.env.JENGA_API_KEY && process.env.JENGA_MERCHANT_CODE && process.env.JENGA_CONSUMER_SECRET) {
        try {
          const { createJengaApiClient } = await import('./services/jengaApi');
          const jengaClient = createJengaApiClient();
          
          const description = room 
            ? `Rent payment for Room ${room.roomNumber}` 
            : `Payment from ${tenant.firstName} ${tenant.lastName}`;

          const jengaResponse = await jengaClient.sendMpesaSTKPush(
            phoneNumber,
            amount,
            reference,
            description
          );

          await storage.updatePayment(payment.id, {
            notes: `${paymentData.notes} - JengaAPI Transaction: ${jengaResponse.transactionId}`,
          });

          res.json({
            success: true,
            message: "STK Push sent successfully",
            paymentId: payment.id,
            transactionId: jengaResponse.transactionId,
            reference: reference,
          });
        } catch (jengaError: any) {
          console.error("JengaAPI STK Push failed:", jengaError);
          
          await storage.updatePayment(payment.id, {
            paymentStatus: "failed",
            notes: `${paymentData.notes} - JengaAPI Error: ${jengaError.message}`,
          });

          res.status(500).json({ 
            message: "Payment request failed",
            paymentId: payment.id,
            error: "STK Push could not be processed"
          });
        }
      } else {
        res.json({
          success: true,
          message: "STK Push initiated successfully (Development Mode)",
          paymentId: payment.id,
          reference: reference,
          note: "JengaAPI credentials not configured - using development mode"
        });
      }
    } catch (error) {
      console.error("Error initiating STK Push:", error);
      res.status(500).json({ message: "Failed to initiate STK Push" });
    }
  });

  // JengaAPI endpoints
  router.post('/api/jenga/webhook', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const callbackData = req.body;
      console.log('JengaAPI Webhook received:', callbackData);

      if (process.env.JENGA_API_KEY && process.env.JENGA_MERCHANT_CODE && process.env.JENGA_CONSUMER_SECRET) {
        const { createJengaApiClient } = await import('./services/jengaApi');
        const jengaClient = createJengaApiClient();
        
        const isValid = await jengaClient.verifyPaymentCallback(callbackData);
        if (!isValid) {
          return res.status(400).json({ message: "Invalid callback signature" });
        }
      }

      if (callbackData.transactionId && callbackData.status) {
        const payments = await storage.getPayments();
        const payment = payments.find(p => 
          p.notes?.includes(callbackData.transactionId) ||
          p.notes?.includes(callbackData.reference)
        );

        if (payment) {
          const newStatus = callbackData.status === 'SUCCESS' || callbackData.status === 'COMPLETED' 
            ? 'completed' 
            : callbackData.status === 'FAILED' 
            ? 'failed' 
            : 'pending';

          await storage.updatePayment(payment.id, {
            paymentStatus: newStatus as any,
            paidDate: newStatus === 'completed' ? new Date() : null,
            mpesaTransactionId: callbackData.transactionId,
            mpesaReceiptNumber: callbackData.receiptNumber || null,
            notes: `${payment.notes} - Status updated via webhook: ${callbackData.status}`,
          });

          console.log(`Payment ${payment.id} status updated to ${newStatus}`);
        }
      }

      res.json({ success: true, message: "Webhook processed" });
    } catch (error) {
      console.error("Error processing JengaAPI webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  router.get('/api/jenga/health', async (req: HttpRequest, res: HttpResponse) => {
    try {
      if (process.env.JENGA_API_KEY && process.env.JENGA_MERCHANT_CODE && process.env.JENGA_CONSUMER_SECRET) {
        const { createJengaApiClient } = await import('./services/jengaApi');
        const jengaClient = createJengaApiClient();
        
        const isHealthy = await jengaClient.healthCheck();
        res.json({ 
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          configured: true 
        });
      } else {
        res.json({ 
          status: 'not_configured',
          message: 'JengaAPI credentials not configured',
          timestamp: new Date().toISOString(),
          configured: false 
        });
      }
    } catch (error) {
      console.error("Error checking JengaAPI health:", error);
      res.status(500).json({ 
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString() 
      });
    }
  });

  router.get('/api/jenga/balance/:accountNumber?', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const accountNumber = req.params?.accountNumber || process.env.JENGA_MERCHANT_CODE;

      if (!accountNumber) {
        return res.status(400).json({ message: "Account number required" });
      }

      if (process.env.JENGA_API_KEY && process.env.JENGA_MERCHANT_CODE && process.env.JENGA_CONSUMER_SECRET) {
        const { createJengaApiClient } = await import('./services/jengaApi');
        const jengaClient = createJengaApiClient();
        
        const balance = await jengaClient.getAccountBalance(accountNumber);
        res.json(balance);
      } else {
        res.json({ 
          accountNumber,
          currency: 'KES',
          balances: {
            available: '0.00',
            actual: '0.00'
          },
          message: 'JengaAPI not configured - development mode'
        });
      }
    } catch (error) {
      console.error("Error fetching account balance:", error);
      res.status(500).json({ message: "Failed to fetch account balance" });
    }
  });

  // SMS Notification routes
  router.get('/api/sms-notifications', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const notifications = await storage.getSmsNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching SMS notifications:", error);
      res.status(500).json({ message: "Failed to fetch SMS notifications" });
    }
  });

  router.post('/api/sms-notifications', async (req: HttpRequest, res: HttpResponse) => {
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
  router.get('/api/settings', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  router.put('/api/settings/:key', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { key } = req.params!;
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
    router.post('/api/seed', async (req: HttpRequest, res: HttpResponse) => {
      try {
        const { seedDatabase } = await import('./seed');
        const result = await seedDatabase();
        res.json({ message: "Database seeded successfully", data: result });
      } catch (error: any) {
        console.error("Error seeding database:", error);
        res.status(500).json({ message: "Failed to seed database", error: error.message });
      }
    });
  }
}