import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  // Temporarily use memory store to debug the authentication flow
  return session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to false for development
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  try {
    app.set("trust proxy", 1);
    app.use(getSession());
    app.use(passport.initialize());
    app.use(passport.session());

    const config = await getOidcConfig();

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      try {
        const user = {};
        updateUserSession(user, tokens);
        const claims = tokens.claims();
        console.log("User claims:", claims);
        await upsertUser(claims);
        console.log("User upserted successfully");
        verified(null, user);
      } catch (error) {
        console.error("Error in verify function:", error);
        verified(error);
      }
    };

    const domains = process.env.REPLIT_DOMAINS!.split(",");
    
    // Add localhost for development testing
    if (process.env.NODE_ENV === 'development') {
      domains.push('localhost');
    }
    
    for (const domain of domains) {
      const callbackURL = domain === 'localhost' 
        ? `http://${domain}:5000/api/callback`
        : `https://${domain}/api/callback`;
      
      const strategy = new Strategy(
        {
          name: `replitauth:${domain}`,
          config,
          scope: "openid email profile offline_access",
          callbackURL: callbackURL,
        },
        verify,
      );
      passport.use(strategy);
    }

    passport.serializeUser((user: Express.User, cb) => {
      console.log("Serializing user:", user);
      cb(null, user);
    });
    
    passport.deserializeUser((user: Express.User, cb) => {
      console.log("Deserializing user:", user);
      cb(null, user);
    });

    app.get("/api/login", (req, res, next) => {
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    app.get("/api/callback", (req, res, next) => {
      console.log("Callback request for hostname:", req.hostname);
      console.log("Callback query params:", req.query);
      console.log("Callback session:", req.session);
      
      passport.authenticate(`replitauth:${req.hostname}`, (err, user, info) => {
        if (err) {
          console.error("Callback authentication error:", err);
          return res.redirect("/api/login");
        }
        
        if (!user) {
          console.error("Callback authentication failed - no user:", info);
          return res.redirect("/api/login");
        }
        
        console.log("Callback authentication successful, logging in user:", user);
        
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error("Login error:", loginErr);
            return res.redirect("/api/login");
          }
          
          console.log("User logged in successfully");
          return res.redirect("/");
        });
      })(req, res, next);
    });

    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });

  } catch (error) {
    console.error("Error in setupAuth:", error);
    throw error;
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  console.log("isAuthenticated check:");
  console.log("- req.isAuthenticated():", req.isAuthenticated?.());
  console.log("- req.user:", req.user);
  console.log("- req.session:", req.session);
  
  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    console.log("Authentication failed: not authenticated or no user");
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!user.expires_at) {
    console.log("Authentication failed: no expires_at");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    console.log("Authentication successful: token valid");
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log("Authentication failed: no refresh token");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    console.log("Attempting token refresh");
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    console.log("Token refresh successful");
    return next();
  } catch (error) {
    console.log("Token refresh failed:", error);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
