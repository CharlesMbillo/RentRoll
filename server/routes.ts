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
    // Generic dev login
    app.get('/api/auth/dev-login', async (req: any, res) => {
      try {
        console.log("Development login attempt");
        
        // Create a test user session
        const testUser = {
          claims: { sub: 'admin-user-001' },
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

    // Role-specific login endpoints
    app.get('/api/auth/dev-login/landlord', async (req: any, res) => {
      const testUser = { claims: { sub: 'admin-user-001' }, access_token: 'dev-token', refresh_token: 'dev-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 };
      req.session.passport = { user: testUser };
      res.json({ message: "Logged in as Landlord/Admin", user: testUser, role: "landlord" });
    });

    app.get('/api/auth/dev-login/caretaker', async (req: any, res) => {
      const testUser = { claims: { sub: 'caretaker-002' }, access_token: 'dev-token', refresh_token: 'dev-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 };
      req.session.passport = { user: testUser };
      res.json({ message: "Logged in as Caretaker", user: testUser, role: "caretaker" });
    });

    app.get('/api/auth/dev-login/tenant', async (req: any, res) => {
      const testUser = { claims: { sub: 'tenant-003' }, access_token: 'dev-token', refresh_token: 'dev-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 };
      req.session.passport = { user: testUser };
      res.json({ message: "Logged in as Tenant", user: testUser, role: "tenant" });
    });

    // Development logout
    app.get('/api/logout', (req: any, res) => {
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ error: "Logout failed" });
        }
        console.log("Development logout request - redirecting to landing");
        res.redirect(302, '/');
      });
    });
  }

  // Direct role-based test endpoints 
  app.get('/api/test/landlord', (req, res) => {
    res.json({
      id: 'admin-user-001',
      email: 'admin@rentflow.com',
      firstName: 'Admin',
      lastName: 'Manager',
      role: 'landlord',
      profileImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  app.get('/api/test/caretaker', (req, res) => {
    res.json({
      id: 'caretaker-002',
      email: 'caretaker@rentflow.com',
      firstName: 'John',
      lastName: 'Caretaker',
      role: 'caretaker',
      profileImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  app.get('/api/test/tenant', (req, res) => {
    res.json({
      id: 'tenant-003',
      email: 'tenant@rentflow.com',
      firstName: 'Jane',
      lastName: 'Tenant',
      role: 'tenant',
      profileImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const roleParam = req.query.role as string;
      console.log(`Auth/user called with role parameter: ${roleParam}`);
      
      const mockUsers = {
        landlord: {
          id: 'admin-user-001',
          email: 'admin@rentflow.com',
          firstName: 'Admin',
          lastName: 'Manager',
          role: 'landlord',
          profileImageUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        caretaker: {
          id: 'caretaker-002',
          email: 'caretaker@rentflow.com',
          firstName: 'John',
          lastName: 'Caretaker',
          role: 'caretaker',
          profileImageUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tenant: {
          id: 'tenant-003',
          email: 'tenant@rentflow.com',
          firstName: 'Jane',
          lastName: 'Tenant',
          role: 'tenant',
          profileImageUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      };

      const role = roleParam && mockUsers[roleParam as keyof typeof mockUsers] ? roleParam : 'landlord';
      const mockUser = mockUsers[role as keyof typeof mockUsers];
      
      console.log(`✅ RETURNING MOCK ${role.toUpperCase()} USER FOR TESTING`);
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

  // JengaAPI M-Pesa STK Push
  app.post('/api/mpesa/stk-push', async (req, res) => {
    try {
      const { phoneNumber, amount, roomId, tenantId } = req.body;
      
      // Validate required fields
      if (!phoneNumber || !amount || !tenantId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get tenant and room details
      const tenant = await storage.getTenant(tenantId);
      const room = roomId ? await storage.getRoom(roomId) : null;

      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Create payment record first
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

      // If JengaAPI is configured, send actual STK Push
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

          // Update payment with JengaAPI transaction ID
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
          
          // Update payment status to failed
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
        // Development mode - simulate successful STK Push
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

  // JengaAPI Webhook/Callback endpoint
  app.post('/api/jenga/webhook', async (req, res) => {
    try {
      const callbackData = req.body;
      console.log('JengaAPI Webhook received:', callbackData);

      // Verify the callback is legitimate
      if (process.env.JENGA_API_KEY && process.env.JENGA_MERCHANT_CODE && process.env.JENGA_CONSUMER_SECRET) {
        const { createJengaApiClient } = await import('./services/jengaApi');
        const jengaClient = createJengaApiClient();
        
        const isValid = await jengaClient.verifyPaymentCallback(callbackData);
        if (!isValid) {
          return res.status(400).json({ message: "Invalid callback signature" });
        }
      }

      // Process payment status update
      if (callbackData.transactionId && callbackData.status) {
        // Find payment by transaction reference or notes containing transaction ID
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

  // JengaAPI Status Check endpoint
  app.get('/api/jenga/payment-status/:transactionId', async (req, res) => {
    try {
      const { transactionId } = req.params;

      if (process.env.JENGA_API_KEY && process.env.JENGA_MERCHANT_CODE && process.env.JENGA_CONSUMER_SECRET) {
        const { createJengaApiClient } = await import('./services/jengaApi');
        const jengaClient = createJengaApiClient();
        
        const status = await jengaClient.getPaymentStatus(transactionId);
        res.json(status);
      } else {
        res.json({ 
          status: 'PENDING',
          message: 'JengaAPI not configured - development mode',
          transactionId 
        });
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
      res.status(500).json({ message: "Failed to check payment status" });
    }
  });

  // JengaAPI Account Balance endpoint
  app.get('/api/jenga/balance/:accountNumber?', async (req, res) => {
    try {
      const accountNumber = req.params.accountNumber || process.env.JENGA_MERCHANT_CODE;

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

  // Unified Payment Provider endpoints
  app.get('/api/providers/health', async (req, res) => {
    try {
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const unifiedService = getUnifiedPaymentService();
      
      const healthStatus = await unifiedService.checkAllProvidersHealth();
      res.json({
        timestamp: new Date().toISOString(),
        providers: healthStatus,
        overall: Object.values(healthStatus).some(status => status) ? 'healthy' : 'unhealthy'
      });
    } catch (error) {
      console.error("Error checking provider health:", error);
      res.status(500).json({ 
        error: 'Failed to check provider health',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/api/providers/capabilities', async (req, res) => {
    try {
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const unifiedService = getUnifiedPaymentService();
      
      const capabilities = await unifiedService.getProviderCapabilities();
      res.json({
        timestamp: new Date().toISOString(),
        providers: capabilities
      });
    } catch (error) {
      console.error("Error fetching provider capabilities:", error);
      res.status(500).json({ 
        error: 'Failed to fetch provider capabilities',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Unified webhook handler
  app.post('/api/webhooks/:provider', async (req, res) => {
    try {
      const { provider } = req.params;
      const { getUnifiedWebhookHandler } = await import('./services/payment-providers/webhook-handler');
      const webhookHandler = getUnifiedWebhookHandler();

      switch (provider.toLowerCase()) {
        case 'jenga':
          await webhookHandler.processJengaWebhook(req, res);
          break;
        case 'safaricom':
          await webhookHandler.processSafaricomWebhook(req, res);
          break;
        case 'coop':
          await webhookHandler.processCoopWebhook(req, res);
          break;
        default:
          res.status(400).json({ error: `Unknown payment provider: ${provider}` });
      }
    } catch (error) {
      console.error(`Error processing ${req.params.provider} webhook:`, error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Payment status checking
  app.get('/api/payments/:transactionId/status/:provider', async (req, res) => {
    try {
      const { transactionId, provider } = req.params;
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const unifiedService = getUnifiedPaymentService();
      
      const status = await unifiedService.checkPaymentStatus(transactionId, provider as any);
      res.json(status);
    } catch (error) {
      console.error("Error checking payment status:", error);
      res.status(500).json({ error: 'Failed to check payment status' });
    }
  });

  // Batch payment processing
  app.post('/api/payments/batch/rent-collection', async (req, res) => {
    try {
      const { month, testMode, providerId } = req.body;
      const { triggerMonthlyRentCollection } = await import('./services/batch-payment-processor');
      
      const result = await triggerMonthlyRentCollection(month, testMode);
      res.json(result);
    } catch (error) {
      console.error("Error processing batch rent collection:", error);
      res.status(500).json({ error: 'Batch rent collection failed' });
    }
  });

  // JengaAPI Health Check endpoint
  app.get('/api/jenga/health', async (req, res) => {
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

  // KYC Verification endpoint
  app.post('/api/jenga/verify-kyc', async (req, res) => {
    try {
      const { nationalId, firstName, lastName } = req.body;

      if (!nationalId || !firstName || !lastName) {
        return res.status(400).json({ message: "National ID, first name and last name are required" });
      }

      if (process.env.JENGA_API_KEY && process.env.JENGA_MERCHANT_CODE && process.env.JENGA_CONSUMER_SECRET) {
        const { createJengaApiClient } = await import('./services/jengaApi');
        const jengaClient = createJengaApiClient();
        
        const verification = await jengaClient.verifyKYC(nationalId, firstName, lastName);
        res.json(verification);
      } else {
        res.json({ 
          verified: true,
          message: 'JengaAPI not configured - development mode accepts all KYC',
          nationalId,
          firstName,
          lastName
        });
      }
    } catch (error) {
      console.error("Error verifying KYC:", error);
      res.status(500).json({ message: "Failed to verify KYC" });
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
        res.status(500).json({ message: "Failed to seed database", error: (error as Error).message });
      }
    });
  }

  // Unified webhook endpoints for all payment providers
  app.post('/api/webhooks/:provider', async (req, res) => {
    try {
      const provider = req.params.provider as 'jenga' | 'safaricom' | 'coop';
      const callbackData = req.body;
      
      console.log(`🔔 Unified webhook received from ${provider}:`, callbackData);

      // Validate provider
      if (!['jenga', 'safaricom', 'coop'].includes(provider)) {
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported provider: ${provider}` 
        });
      }

      // Import unified payment service
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const paymentService = getUnifiedPaymentService();

      // Check if provider is available
      const availableProviders = paymentService.getAvailableProviders();
      if (!availableProviders.includes(provider)) {
        return res.status(503).json({ 
          success: false, 
          message: `Provider ${provider} is not available or configured` 
        });
      }

      // Process webhook through unified service
      const webhookResult = await paymentService.processWebhookCallback(callbackData, provider);
      
      // Update payment record in database if transaction ID is provided
      if (webhookResult.transactionId || webhookResult.reference) {
        const payments = await storage.getPayments();
        
        // Find payment by various identifiers
        const payment = payments.find(p => 
          (webhookResult.transactionId && (
            p.transactionId === webhookResult.transactionId ||
            p.mpesaTransactionId === webhookResult.transactionId ||
            p.checkoutRequestId === webhookResult.transactionId ||
            p.notes?.includes(webhookResult.transactionId)
          )) ||
          (webhookResult.reference && (
            p.reference === webhookResult.reference ||
            p.notes?.includes(webhookResult.reference)
          ))
        );

        if (payment) {
          const updateData: any = {
            paymentStatus: webhookResult.status,
            updatedAt: new Date(),
          };

          // Set completion date if successful
          if (webhookResult.status === 'completed') {
            updateData.paidDate = webhookResult.completedAt || new Date();
          }

          // Update provider-specific fields
          if (provider === 'jenga') {
            updateData.mpesaTransactionId = webhookResult.transactionId;
            updateData.mpesaReceiptNumber = webhookResult.receiptNumber;
          } else if (provider === 'safaricom') {
            updateData.mpesaTransactionId = webhookResult.transactionId;
            updateData.mpesaReceiptNumber = webhookResult.receiptNumber;
          }

          // Store webhook data
          updateData.providerData = webhookResult.providerData;
          updateData.failureReason = webhookResult.failureReason;

          // Update notes
          updateData.notes = `${payment.notes || ''} - Webhook ${webhookResult.status} at ${new Date().toISOString()}`.trim();

          await storage.updatePayment(payment.id, updateData);
          
          console.log(`✅ Payment ${payment.id} updated via ${provider} webhook: ${webhookResult.status}`);
        } else {
          console.warn(`⚠️ No payment found for webhook from ${provider}:`, {
            transactionId: webhookResult.transactionId,
            reference: webhookResult.reference
          });
        }
      }

      res.json({ 
        success: true, 
        message: `Webhook processed successfully`,
        provider,
        status: webhookResult.status,
        transactionId: webhookResult.transactionId 
      });

    } catch (error) {
      console.error(`❌ Error processing webhook from ${req.params.provider}:`, error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to process webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider: req.params.provider 
      });
    }
  });

  // Unified payment status endpoint
  app.get('/api/payments/:transactionId/status/:provider', async (req, res) => {
    try {
      const { transactionId, provider } = req.params;
      
      if (!['jenga', 'safaricom', 'coop'].includes(provider)) {
        return res.status(400).json({ message: `Unsupported provider: ${provider}` });
      }

      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const paymentService = getUnifiedPaymentService();
      
      const status = await paymentService.getPaymentStatus(transactionId, provider as any);
      res.json(status);
    } catch (error) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ message: "Failed to fetch payment status" });
    }
  });

  // Unified provider health check endpoint
  app.get('/api/providers/health', async (req, res) => {
    try {
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const paymentService = getUnifiedPaymentService();
      
      const healthStatus = await paymentService.checkAllProvidersHealth();
      res.json({
        providers: healthStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error checking provider health:", error);
      res.status(500).json({ message: "Failed to check provider health" });
    }
  });

  // Unified provider capabilities endpoint
  app.get('/api/providers/capabilities', async (req, res) => {
    try {
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const paymentService = getUnifiedPaymentService();
      
      const availableProviders = paymentService.getAvailableProviders();
      const capabilities: Record<string, any> = {};
      
      for (const providerType of availableProviders) {
        const provider = paymentService.getProvider(providerType);
        capabilities[providerType] = {
          type: provider.providerType,
          capabilities: provider.capabilities,
          config: {
            enabled: provider.config.enabled,
            sandbox: provider.config.sandbox
          }
        };
      }
      
      res.json({
        providers: capabilities,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching provider capabilities:", error);
      res.status(500).json({ message: "Failed to fetch provider capabilities" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
