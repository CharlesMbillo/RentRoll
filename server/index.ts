import express from "express";
import { createServer } from "http";
import { HttpRouter, createLoggingMiddleware, createJsonMiddleware } from "./http-router";
import { setupApiRoutes } from "./api-routes";
import { setupVite, serveStatic, log } from "./vite";

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

(async () => {
  // Create HTTP router for API routes
  const router = new HttpRouter();

  // Add middlewares
  router.use(createJsonMiddleware());
  router.use(createLoggingMiddleware());

  // Setup API routes
  await setupApiRoutes(router);

  // Create Express app for Vite compatibility
  const app = express();

  // Create HTTP server with hybrid routing
  const server = createServer(async (req, res) => {
    try {
      // Handle API routes with custom router
      if (req.url?.startsWith('/api')) {
        await router.handle(req, res);
      } else {
        // Handle static files and frontend with Express/Vite
        app(req, res);
      }
    } catch (error) {
      console.error('Server error:', error);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: 'Internal Server Error' }));
      }
    }
  });

  // Setup Vite in development or serve static files in production
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
