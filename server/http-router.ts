import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { parse as parseQuery } from 'querystring';

export interface HttpRequest extends IncomingMessage {
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  path?: string;
  method?: string;
  session?: any;
  user?: any;
  isAuthenticated?: () => boolean;
}

export interface HttpResponse extends ServerResponse {
  json: (data: any) => void;
  status: (code: number) => HttpResponse;
  send: (data: string) => void;
}

export type RouteHandler = (req: HttpRequest, res: HttpResponse) => Promise<void> | void;

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

export class HttpRouter {
  private routes: Route[] = [];
  private middlewares: RouteHandler[] = [];

  // Add middleware
  use(handler: RouteHandler) {
    this.middlewares.push(handler);
  }

  // Add routes
  get(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'GET', path, handler });
  }

  post(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'POST', path, handler });
  }

  put(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'PUT', path, handler });
  }

  delete(path: string, handler: RouteHandler) {
    this.routes.push({ method: 'DELETE', path, handler });
  }

  // Parse request body
  private async parseBody(req: HttpRequest): Promise<any> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const contentType = req.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            resolve(JSON.parse(body || '{}'));
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            resolve(parseQuery(body));
          } else {
            resolve(body);
          }
        } catch (error) {
          resolve({});
        }
      });
    });
  }

  // Extract path parameters
  private extractParams(routePath: string, actualPath: string): Record<string, string> | null {
    const routeParts = routePath.split('/');
    const actualParts = actualPath.split('/');

    if (routeParts.length !== actualParts.length) {
      return null;
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const actualPart = actualParts[i];

      if (routePart.startsWith(':')) {
        params[routePart.slice(1)] = actualPart;
      } else if (routePart !== actualPart) {
        return null;
      }
    }

    return params;
  }

  // Check if route matches
  private matchRoute(route: Route, method: string, path: string): { params: Record<string, string> } | null {
    if (route.method !== method) {
      return null;
    }

    const params = this.extractParams(route.path, path);
    return params !== null ? { params } : null;
  }

  // Enhanced response object
  private enhanceResponse(res: ServerResponse): HttpResponse {
    const enhanced = res as HttpResponse;

    enhanced.json = function(data: any) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
    };

    enhanced.status = function(code: number) {
      this.statusCode = code;
      return this;
    };

    enhanced.send = function(data: string) {
      this.setHeader('Content-Type', 'text/plain');
      this.end(data);
    };

    return enhanced;
  }

  // Enhanced request object
  private async enhanceRequest(req: IncomingMessage): Promise<HttpRequest> {
    const enhanced = req as HttpRequest;
    const parsedUrl = parse(req.url || '', true);
    
    enhanced.path = parsedUrl.pathname || '/';
    enhanced.query = parsedUrl.query as Record<string, string>;
    enhanced.method = req.method?.toUpperCase();
    enhanced.body = await this.parseBody(enhanced);

    return enhanced;
  }

  // Handle incoming requests
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const enhancedReq = await this.enhanceRequest(req);
      const enhancedRes = this.enhanceResponse(res);

      // CORS headers
      enhancedRes.setHeader('Access-Control-Allow-Origin', '*');
      enhancedRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      enhancedRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      // Handle preflight requests
      if (enhancedReq.method === 'OPTIONS') {
        enhancedRes.statusCode = 200;
        enhancedRes.end();
        return;
      }

      // Run middlewares
      for (const middleware of this.middlewares) {
        if (typeof middleware === 'function') {
          try {
            await middleware(enhancedReq, enhancedRes);
            if (enhancedRes.writableEnded) return;
          } catch (middlewareError) {
            console.error('Middleware error:', middlewareError);
            if (!enhancedRes.writableEnded) {
              enhancedRes.status(500).json({ message: 'Middleware error' });
              return;
            }
          }
        }
      }

      // Find matching route
      const method = enhancedReq.method || 'GET';
      const path = enhancedReq.path || '/';

      for (const route of this.routes) {
        const match = this.matchRoute(route, method, path);
        if (match) {
          enhancedReq.params = match.params;
          try {
            await route.handler(enhancedReq, enhancedRes);
            return;
          } catch (routeError) {
            console.error('Route handler error:', routeError);
            if (!enhancedRes.writableEnded) {
              enhancedRes.status(500).json({ message: 'Route handler error' });
              return;
            }
          }
        }
      }

      // No route found
      if (!enhancedRes.writableEnded) {
        enhancedRes.status(404).json({ message: 'Route not found' });
      }
    } catch (error) {
      console.error('Router error:', error);
      if (!res.writableEnded) {
        const enhancedRes = this.enhanceResponse(res);
        enhancedRes.status(500).json({ message: 'Internal server error' });
      }
    }
  }
}

// Utility function to create logging middleware
export function createLoggingMiddleware() {
  return (req: HttpRequest, res: HttpResponse) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalJson = res.json;
    res.json = function(bodyJson: any) {
      capturedJsonResponse = bodyJson;
      return originalJson.call(this, bodyJson);
    };

    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - start;
      if (path?.startsWith('/api')) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + '…';
        }

        console.log(`[express] ${logLine}`);
      }
      return (originalEnd as any).apply(this, args);
    };
  };
}

// Utility function to create JSON parsing middleware
export function createJsonMiddleware() {
  return async (req: HttpRequest, res: HttpResponse) => {
    // Body is already parsed in enhanceRequest
    if (req.headers['content-type']?.includes('application/json') && !req.body) {
      req.body = {};
    }
  };
}