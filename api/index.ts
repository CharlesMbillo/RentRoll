// Vercel serverless function entry point
import { HttpRouter, createLoggingMiddleware, createJsonMiddleware } from '../server/http-router';
import { setupApiRoutes } from '../server/api-routes';

// Create HTTP router for serverless environment
const router = new HttpRouter();

// Add middlewares
router.use(createJsonMiddleware());
router.use(createLoggingMiddleware());

// Setup API routes
setupApiRoutes(router);

// Export Vercel handler
export default async (req: any, res: any) => {
  try {
    await router.handle(req, res);
  } catch (error) {
    console.error('Vercel API error:', error);
    if (!res.writableEnded) {
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};