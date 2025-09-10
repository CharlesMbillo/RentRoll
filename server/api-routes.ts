import { HttpRouter, HttpRequest, HttpResponse } from './http-router';
import { storage } from './storage';
import { insertTenantSchema, insertPaymentSchema, insertRoomSchema } from '@shared/schema';
import { z } from 'zod';
import { sessionManager } from './session-manager';
import { vercelSessionManager } from './vercel-session-manager';
import { tenantAssignmentService } from './tenant-assignment-service';
import { triggerMonthlyRentCollection, getBatchPaymentProcessor } from './services/batch-payment-processor';

// Helper function to extract JWT session from cookies
function extractJWTFromCookies(req: HttpRequest): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  
  // Parse cookies to find rf.session (app-specific JWT cookie)
  const cookies = cookieHeader.split(';').reduce((acc: any, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {});
  
  return cookies['rf.session'] || undefined;
}

// Authentication and Authorization Middleware  
async function requireAuthentication(req: HttpRequest, res: HttpResponse): Promise<any> {
  // Try Authorization header first, then rf.session cookie
  let sessionToken = req.headers?.authorization?.replace('Bearer ', '');
  
  if (!sessionToken) {
    sessionToken = extractJWTFromCookies(req);
  }
  
  // Also support sessionId query param for backward compatibility
  if (!sessionToken) {
    sessionToken = req.query?.sessionId as string;
  }
  
  if (!sessionToken) {
    console.log('❌ Authentication failed: No session token provided');
    return res.status(401).json({ 
      message: "Unauthorized: Session token required",
      error: "MISSING_SESSION_TOKEN"
    });
  }

  // Always use vercelSessionManager for JWT validation (unified approach)
  try {
    const user = await vercelSessionManager.getUserFromSession(sessionToken);
    if (!user) {
      console.log('❌ Authentication failed: Invalid or expired session token');
      return res.status(401).json({ 
        message: "Unauthorized: Invalid or expired session",
        error: "INVALID_SESSION"
      });
    }

    console.log(`✅ Authentication successful: ${user.role} (${user.firstName} ${user.lastName})`);
    return user;
  } catch (error) {
    console.error('❌ Authentication error:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(401).json({ 
      message: "Unauthorized: Session validation failed",
      error: "SESSION_VALIDATION_ERROR"
    });
  }
}

async function requireLandlordRole(req: HttpRequest, res: HttpResponse): Promise<any> {
  const user = await requireAuthentication(req, res);
  
  // If authentication failed, response is already sent
  if (!user || res.writableEnded) {
    return null;
  }

  if (user.role !== 'landlord') {
    console.log(`❌ Authorization failed: User ${user.firstName} ${user.lastName} has role '${user.role}' but 'landlord' required`);
    return res.status(403).json({ 
      message: "Forbidden: Landlord role required for this operation",
      error: "INSUFFICIENT_PERMISSIONS",
      userRole: user.role,
      requiredRole: 'landlord'
    });
  }

  console.log(`✅ Authorization successful: Landlord ${user.firstName} ${user.lastName} authorized`);
  return user;
}

export async function setupApiRoutes(router: HttpRouter): Promise<void> {
  
  
  // Production-ready authentication routes

  // Logout endpoint
  router.get('/api/logout', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const sessionId = req.query?.sessionId as string;
      console.log(`🔐 LOGOUT REQUEST - SessionId: ${sessionId}`);
      
      // Determine which session manager to use
      const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
      const currentSessionManager = isVercel ? vercelSessionManager : sessionManager;
      
      // Destroy session if exists
      if (sessionId) {
        const destroyed = currentSessionManager.destroySession(sessionId);
        console.log(`🔐 SESSION DESTRUCTION RESULT: ${destroyed ? 'SUCCESS' : 'FAILED'} for ${sessionId}`);
      } else {
        console.log("🔐 NO SESSION ID PROVIDED FOR LOGOUT");
      }
      
      // Set redirect headers manually
      res.status(302);
      res.setHeader('Location', '/');
      res.end();
    } catch (error) {
      console.error("Error in logout:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Login endpoint - redirects to landing page
  router.get('/api/login', async (req: HttpRequest, res: HttpResponse) => {
    try {
      console.log("🔐 LOGIN REQUEST - REDIRECTING TO LANDING PAGE");
      // Set redirect headers manually
      res.status(302);
      res.setHeader('Location', '/');
      res.end();
    } catch (error) {
      console.error("Error in login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // =======================================
  // AUTHENTICATION & AUTHORIZATION HELPERS
  // =======================================

  /**
   * Extract session ID from cookies (used by Express sessions)
   */
  function extractSessionIdFromCookies(req: HttpRequest): string | null {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return null;
    }
    
    // Parse cookies to find connect.sid (default express-session cookie name)
    const cookies = cookieHeader.split(';').reduce((acc: any, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});
    
    // Extract session ID (remove 's:' prefix if present)
    let sessionId = cookies['connect.sid'];
    if (sessionId && sessionId.startsWith('s:')) {
      sessionId = sessionId.slice(2).split('.')[0]; // Remove signature
    }
    
    return sessionId;
  }

  // Auth routes
  router.get('/api/auth/user', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const roleParam = req.query?.role as string;
      let sessionToken = req.headers?.authorization?.replace('Bearer ', '') || 
                        extractJWTFromCookies(req) || 
                        req.query?.sessionId as string;
      
      console.log(`🔐 AUTH REQUEST: role=${roleParam}, sessionToken=${sessionToken ? 'present' : 'undefined'}`);
      
      let user = null;
      
      if (sessionToken) {
        user = await vercelSessionManager.getUserFromSession(sessionToken);
      }
      
      // Support role switching for development/testing
      if (roleParam && !user) {
        console.log(`⚠️ Creating JWT session for role: ${roleParam}`);
        
        // Create test user data based on role
        const testUserData = {
          id: `test-${roleParam}-user`,
          email: `${roleParam}@test.com`,
          firstName: roleParam === 'landlord' ? 'Admin' : 
                   roleParam === 'caretaker' ? 'Care' : 'Test',
          lastName: roleParam === 'landlord' ? 'Manager' : 
                   roleParam === 'caretaker' ? 'Taker' : 'User',
          role: roleParam as 'landlord' | 'caretaker' | 'tenant',
          profileImageUrl: null,
        };
        
        // Create session and encode as JWT token
        const session = vercelSessionManager.createSession(roleParam as 'landlord' | 'caretaker' | 'tenant');
        const jwtToken = vercelSessionManager.encodeSession(session);
        user = testUserData;
        
        console.log(`✅ JWT session created for ${roleParam}`);
        
        // Set HTTP-only cookie for browser security
        const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';
        const cookieOptions = `HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${isProduction ? '; Secure' : ''}`; // 7 days
        res.setHeader('Set-Cookie', `rf.session=${jwtToken}; ${cookieOptions}`);
        
        // Return the session token for frontend Authorization headers
        return res.json({
          user,
          sessionToken: jwtToken,
          sessionId: jwtToken,  // Also include sessionId for backward compatibility
          role: roleParam,
          message: "JWT session created successfully"
        });
      }
      
      if (!user) {
        console.log('❌ INVALID SESSION: Token verification failed');
        console.log('❌ NO VALID SESSION OR ROLE - UNAUTHORIZED');
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      res.json({ 
        user,
        sessionToken,
        sessionId: sessionToken, // For backward compatibility
        role: user.role,
        message: "Authentication successful"
      });
      
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

  // Tenant Assignment routes
  router.post('/api/assignments/assign', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { tenantId, roomId, assignedBy } = req.body;
      const success = await tenantAssignmentService.assignTenantToRoom(tenantId, roomId, assignedBy);
      res.json({ success, message: success ? 'Tenant assigned successfully' : 'Assignment failed' });
    } catch (error) {
      console.error("Error assigning tenant:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to assign tenant" });
    }
  });

  router.post('/api/assignments/unassign', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { tenantId, reason } = req.body;
      const success = await tenantAssignmentService.unassignTenantFromRoom(tenantId, reason);
      res.json({ success, message: success ? 'Tenant unassigned successfully' : 'Unassignment failed' });
    } catch (error) {
      console.error("Error unassigning tenant:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to unassign tenant" });
    }
  });

  router.get('/api/assignments/assigned-tenants', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const assignedTenants = await tenantAssignmentService.getAssignedTenants();
      res.json(assignedTenants);
    } catch (error) {
      console.error("Error fetching assigned tenants:", error);
      res.status(500).json({ message: "Failed to fetch assigned tenants" });
    }
  });

  router.get('/api/assignments/unassigned-tenants', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const unassignedTenants = await tenantAssignmentService.getUnassignedTenants();
      res.json(unassignedTenants);
    } catch (error) {
      console.error("Error fetching unassigned tenants:", error);
      res.status(500).json({ message: "Failed to fetch unassigned tenants" });
    }
  });

  router.get('/api/assignments/available-rooms', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const availableRooms = await tenantAssignmentService.getAvailableRooms();
      res.json(availableRooms);
    } catch (error) {
      console.error("Error fetching available rooms:", error);
      res.status(500).json({ message: "Failed to fetch available rooms" });
    }
  });

  router.get('/api/assignments/occupancy-summary', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const summary = await tenantAssignmentService.getOccupancySummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching occupancy summary:", error);
      res.status(500).json({ message: "Failed to fetch occupancy summary" });
    }
  });

  router.post('/api/assignments/bulk-assign', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { assignments } = req.body;
      const result = await tenantAssignmentService.bulkAssignTenants(assignments);
      res.json(result);
    } catch (error) {
      console.error("Error in bulk assignment:", error);
      res.status(500).json({ message: "Failed to perform bulk assignment" });
    }
  });

  router.get('/api/assignments/suggestions', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const suggestions = await tenantAssignmentService.suggestRoomAssignments();
      res.json(suggestions);
    } catch (error) {
      console.error("Error generating assignment suggestions:", error);
      res.status(500).json({ message: "Failed to generate assignment suggestions" });
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

  // Unified Payment Provider endpoints
  router.get('/api/providers/health', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const unifiedService = getUnifiedPaymentService();
      
      const healthStatus = await unifiedService.checkAllProvidersHealth();
      
      // System is healthy only if ALL enabled providers are healthy
      // If no providers are enabled, system is unhealthy
      const enabledProviders = Object.keys(healthStatus);
      const healthyProviders = Object.values(healthStatus).filter(status => status);
      const overallHealthy = enabledProviders.length > 0 && healthyProviders.length === enabledProviders.length;
      
      res.json({
        timestamp: new Date().toISOString(),
        providers: healthStatus,
        overall: overallHealthy ? 'healthy' : 'unhealthy',
        summary: {
          total: enabledProviders.length,
          healthy: healthyProviders.length,
          unhealthy: enabledProviders.length - healthyProviders.length
        }
      });
    } catch (error) {
      console.error("Error checking provider health:", error);
      res.status(500).json({ 
        error: 'Failed to check provider health',
        timestamp: new Date().toISOString()
      });
    }
  });

  router.get('/api/providers/capabilities', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const unifiedService = getUnifiedPaymentService();
      
      const capabilities = unifiedService.getAllProviderCapabilities();
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
  router.post('/api/webhooks/:provider', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const provider = req.params!.provider;
      const { getUnifiedWebhookHandler } = await import('./services/payment-providers/webhook-handler');
      const webhookHandler = getUnifiedWebhookHandler();

      // Create a mock Express-style request/response for compatibility
      const mockReq = { ...req, params: { provider } } as any;
      const mockRes = res as any;

      switch (provider.toLowerCase()) {
        case 'jenga':
          await webhookHandler.processJengaWebhook(mockReq, mockRes);
          break;
        case 'safaricom':
          await webhookHandler.processSafaricomWebhook(mockReq, mockRes);
          break;
        case 'coop':
          await webhookHandler.processCoopWebhook(mockReq, mockRes);
          break;
        default:
          res.status(400).json({ error: `Unknown payment provider: ${provider}` });
      }
    } catch (error) {
      console.error(`Error processing ${req.params!.provider} webhook:`, error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Payment status checking
  router.get('/api/payments/:transactionId/status/:provider', async (req: HttpRequest, res: HttpResponse) => {
    try {
      const { transactionId, provider } = req.params!;
      const { getUnifiedPaymentService } = await import('./services/payment-providers/unified-payment-service');
      const unifiedService = getUnifiedPaymentService();
      
      const status = await unifiedService.getPaymentStatus(transactionId, provider as any);
      res.json(status);
    } catch (error) {
      console.error("Error checking payment status:", error);
      res.status(500).json({ error: 'Failed to check payment status' });
    }
  });

  // Batch payment processing
  router.post('/api/payments/batch/rent-collection', async (req: HttpRequest, res: HttpResponse) => {
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

  // Batch payment processing endpoints
  router.post('/api/batch-payments/trigger', async (req: HttpRequest, res: HttpResponse) => {
    try {
      // 🔐 SECURITY: Require landlord authentication and authorization
      const authorizedUser = await requireLandlordRole(req, res);
      if (!authorizedUser || res.writableEnded) {
        return; // Authorization failed, response already sent
      }

      const { month, testMode: clientTestMode } = req.body || {};
      
      // 🔒 SECURITY: Enforce testMode=true in non-production environments
      const isProduction = process.env.NODE_ENV === 'production' && process.env.VERCEL === '1';
      const testMode = isProduction ? (clientTestMode ?? true) : true;
      
      if (!isProduction && !testMode) {
        console.log('🔒 SECURITY: Forcing testMode=true in non-production environment');
      }
      
      console.log(`🚀 Batch payment trigger requested by ${authorizedUser.firstName} ${authorizedUser.lastName} (${authorizedUser.role})`);
      console.log(`📋 Parameters - Month: ${month}, Test Mode: ${testMode}, Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
      
      // Use the batch payment processor to trigger monthly collection
      const result = await triggerMonthlyRentCollection(month, testMode);
      
      console.log(`✅ Batch processing result:`, {
        batchId: result.batchId,
        totalTenants: result.totalTenants,
        successful: result.successfulPayments,
        failed: result.failedPayments,
        totalAmount: result.totalAmount,
        triggeredBy: `${authorizedUser.firstName} ${authorizedUser.lastName}`,
        testMode
      });

      res.json({
        success: true,
        message: 'Batch payment processing completed',
        data: {
          ...result,
          triggeredBy: authorizedUser.userId,
          testMode,
          environment: isProduction ? 'production' : 'development'
        }
      });
    } catch (error: any) {
      console.error('❌ Batch payment trigger failed:', error);
      res.status(500).json({
        success: false,
        message: 'Batch payment processing failed',
        error: error.message
      });
    }
  });

  router.get('/api/batch-payments/status/:batchId', async (req: HttpRequest, res: HttpResponse) => {
    try {
      // 🔐 SECURITY: Require landlord authentication and authorization
      const authorizedUser = await requireLandlordRole(req, res);
      if (!authorizedUser || res.writableEnded) {
        return; // Authorization failed, response already sent
      }

      const { batchId } = req.params || {};
      
      if (!batchId) {
        console.log('❌ Batch status request failed: Missing batchId parameter');
        return res.status(400).json({
          success: false,
          message: 'Batch ID is required'
        });
      }

      console.log(`📊 Batch status requested by ${authorizedUser.firstName} ${authorizedUser.lastName} (${authorizedUser.role}) for batch: ${batchId}`);

      const processor = getBatchPaymentProcessor();
      const status = await processor.getBatchStatus(batchId);
      
      console.log(`✅ Batch status retrieved for ${batchId}: ${status.status} (${status.completionPercentage?.toFixed(1)}% complete)`);
      
      res.json({
        success: true,
        data: {
          ...status,
          accessedBy: authorizedUser.userId,
          accessTime: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('❌ Failed to get batch status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get batch status',
        error: error.message
      });
    }
  });
}