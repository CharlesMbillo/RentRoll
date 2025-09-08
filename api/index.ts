// Vercel serverless function entry point
import express from 'express';
import { setupApiRoutes } from '../server/api-routes.js';
import { HttpRouter } from '../server/http-router.js';

const app = express();
const router = new HttpRouter();

// Setup API routes
setupApiRoutes(router);

// Handle all requests through the router
app.use((req, res) => {
  router.handle(req, res);
});

export default app;