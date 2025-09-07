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
  // Create HTTP router
  const router = new HttpRouter();

  // Add middlewares
  router.use(createJsonMiddleware());
  router.use(createLoggingMiddleware());

  // Setup API routes
  await setupApiRoutes(router);

  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      await router.handle(req, res);
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
    await setupVite(router as any, server);
  } else {
    serveStatic(router as any);
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
