import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

export interface UserSession {
  id: string;
  userId: string;
  role: 'landlord' | 'caretaker' | 'tenant';
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

// Serverless-compatible session manager using stateless tokens
export class VercelSessionManager {
  private readonly sessionDuration = 24 * 60 * 60 * 1000; // 24 hours

  private mockUsers = {
    landlord: {
      id: 'admin-user-001',
      email: 'admin@rentflow.com',
      firstName: 'Admin',
      lastName: 'Manager',
      role: 'landlord' as const,
      profileImageUrl: null,
    },
    caretaker: {
      id: 'caretaker-002',
      email: 'caretaker@rentflow.com',
      firstName: 'John',
      lastName: 'Caretaker',
      role: 'caretaker' as const,
      profileImageUrl: null,
    },
    tenant: {
      id: 'tenant-003',
      email: 'tenant@rentflow.com',
      firstName: 'Jane',
      lastName: 'Tenant',
      role: 'tenant' as const,
      profileImageUrl: null,
    }
  };

  createSession(role: 'landlord' | 'caretaker' | 'tenant'): UserSession {
    const sessionId = randomUUID();
    const mockUser = this.mockUsers[role];
    const now = new Date();
    
    const session: UserSession = {
      id: sessionId,
      userId: mockUser.id,
      role: mockUser.role,
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      profileImageUrl: mockUser.profileImageUrl,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.sessionDuration),
      isActive: true
    };

    console.log(`🔐 VERCEL SESSION CREATED: ${sessionId} for ${role} (${mockUser.firstName} ${mockUser.lastName})`);
    return session;
  }

  // Get signing secret for JWT
  private getSigningSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      throw new Error('SESSION_SECRET environment variable is required for secure session signing');
    }
    return secret;
  }

  // For serverless, we encode session data in a signed JWT token
  encodeSession(session: UserSession): string {
    const payload = {
      id: session.id,
      userId: session.userId,
      role: session.role,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
      profileImageUrl: session.profileImageUrl,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isActive: session.isActive,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(session.expiresAt.getTime() / 1000)
    };
    
    try {
      const token = jwt.sign(payload, this.getSigningSecret(), {
        algorithm: 'HS256',
        issuer: 'rentflow-auth',
        audience: 'rentflow-client'
      });
      
      console.log(`🔐 JWT SESSION SIGNED: ${session.id} (${session.role})`);
      return token;
    } catch (error) {
      console.error('Failed to sign JWT token:', error);
      throw new Error('Session signing failed');
    }
  }

  // Verify and decode JWT session token
  decodeSession(jwtToken: string): UserSession | null {
    try {
      const decoded = jwt.verify(jwtToken, this.getSigningSecret(), {
        algorithms: ['HS256'],
        issuer: 'rentflow-auth',
        audience: 'rentflow-client'
      }) as any;
      
      // Additional validation
      if (!decoded.id || !decoded.userId || !decoded.role) {
        console.error('Invalid JWT payload: missing required fields');
        return null;
      }
      
      // Check if session is still active
      const expiresAt = new Date(decoded.expiresAt);
      if (new Date() > expiresAt || !decoded.isActive) {
        console.log(`Session expired or inactive: ${decoded.id}`);
        return null;
      }
      
      // Validate role
      if (!['landlord', 'caretaker', 'tenant'].includes(decoded.role)) {
        console.error(`Invalid role in JWT: ${decoded.role}`);
        return null;
      }

      console.log(`🔐 JWT SESSION VERIFIED: ${decoded.id} (${decoded.role})`);
      
      return {
        id: decoded.id,
        userId: decoded.userId,
        role: decoded.role,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        profileImageUrl: decoded.profileImageUrl,
        createdAt: new Date(decoded.createdAt),
        expiresAt: expiresAt,
        isActive: decoded.isActive
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log('JWT token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.error('Invalid JWT token:', error.message);
      } else {
        console.error('Failed to verify JWT token:', error);
      }
      return null;
    }
  }

  getUserFromSession(sessionId: string): UserSession | null {
    // For serverless, session ID is the encoded session data
    return this.decodeSession(sessionId);
  }

  getUserFromRole(role: 'landlord' | 'caretaker' | 'tenant'): UserSession {
    const session = this.createSession(role);
    return session;
  }

  destroySession(sessionId: string): boolean {
    console.log(`🔐 VERCEL SESSION DESTROY REQUESTED: ${sessionId}`);
    // In serverless environment, we can't maintain a blacklist easily
    // The JWT will naturally expire based on its 'exp' claim
    // For immediate revocation, you would need to maintain a Redis/DB blacklist
    console.log('🔐 SESSION MARKED FOR DESTRUCTION (JWT will expire naturally)');
    return true;
  }

  switchRole(sessionId: string, newRole: 'landlord' | 'caretaker' | 'tenant'): UserSession {
    // Validate the existing session first
    const currentSession = this.decodeSession(sessionId);
    if (!currentSession) {
      throw new Error('Invalid session for role switching');
    }
    
    console.log(`🔐 ROLE SWITCH: ${currentSession.role} → ${newRole} for user ${currentSession.firstName}`);
    
    // Create new session with the new role
    return this.createSession(newRole);
  }
}

// Export singleton instance
export const vercelSessionManager = new VercelSessionManager();