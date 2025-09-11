import { randomUUID, createPrivateKey, createPublicKey } from 'crypto';
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

  // Format PEM key with proper line breaks
  private formatPemKey(key: string): string {
    // Convert escaped newlines to actual newlines first
    const normalized = key.replace(/\\n/g, '\n');
    
    if (normalized.includes('\n')) {
      return normalized; // Already properly formatted
    }
    
    // Support both PKCS#1 and PKCS#8 formats
    const pkcs1Pattern = /-----BEGIN RSA (PRIVATE|PUBLIC) KEY-----(.+)-----END RSA (PRIVATE|PUBLIC) KEY-----/;
    const pkcs8Pattern = /-----BEGIN (PRIVATE|PUBLIC) KEY-----(.+)-----END (PRIVATE|PUBLIC) KEY-----/;
    
    if (pkcs1Pattern.test(normalized)) {
      return normalized.replace(pkcs1Pattern, (match, type1, content, type2) => {
        const cleanKey = content.replace(/\s+/g, '');
        const formattedKey = cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey;
        return `-----BEGIN RSA ${type1} KEY-----\n${formattedKey}\n-----END RSA ${type2} KEY-----`;
      });
    } else {
      return normalized.replace(pkcs8Pattern, (match, type1, content, type2) => {
        const cleanKey = content.replace(/\s+/g, '');
        const formattedKey = cleanKey.match(/.{1,64}/g)?.join('\n') || cleanKey;
        return `-----BEGIN ${type1} KEY-----\n${formattedKey}\n-----END ${type2} KEY-----`;
      });
    }
  }

  // Get RSA private key for JWT signing
  private getPrivateKey() {
    const privateKey = process.env.JWT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('JWT_PRIVATE_KEY environment variable is required for RSA-based JWT signing');
    }
    const formattedKey = this.formatPemKey(privateKey);
    return createPrivateKey(formattedKey);
  }

  // Get RSA public key for JWT verification
  private getPublicKey() {
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('JWT_PUBLIC_KEY environment variable is required for RSA-based JWT verification');
    }
    const formattedKey = this.formatPemKey(publicKey);
    return createPublicKey(formattedKey);
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
      const token = jwt.sign(payload, this.getPrivateKey(), {
        algorithm: 'RS256',
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
      const decoded = jwt.verify(jwtToken, this.getPublicKey(), {
        algorithms: ['RS256'],
        issuer: 'rentflow-auth',
        audience: 'rentflow-client'
      }) as any;
      
      // Additional validation
      if (!decoded.id || !decoded.userId || !decoded.role) {
        console.error('Invalid JWT payload: missing required fields');
        return null;
      }
      
      // Check if session is still active (JWT exp claim is already validated by jwt.verify)
      if (!decoded.isActive) {
        console.log(`Session inactive: ${decoded.id}`);
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
        expiresAt: new Date(decoded.expiresAt),
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

  getUserFromRole(role: 'landlord' | 'caretaker' | 'tenant'): string {
    const session = this.createSession(role);
    return this.encodeSession(session);
  }

  destroySession(sessionId: string): boolean {
    console.log(`🔐 VERCEL SESSION DESTROY REQUESTED: ${sessionId}`);
    // In serverless environment, we can't maintain a blacklist easily
    // The JWT will naturally expire based on its 'exp' claim
    // For immediate revocation, you would need to maintain a Redis/DB blacklist
    console.log('🔐 SESSION MARKED FOR DESTRUCTION (JWT will expire naturally)');
    return true;
  }

  switchRole(sessionId: string, newRole: 'landlord' | 'caretaker' | 'tenant'): string {
    // Validate the existing session first
    const currentSession = this.decodeSession(sessionId);
    if (!currentSession) {
      throw new Error('Invalid session for role switching');
    }
    
    console.log(`🔐 ROLE SWITCH: ${currentSession.role} → ${newRole} for user ${currentSession.firstName}`);
    
    // Create new session with the new role and return encoded token
    const newSession = this.createSession(newRole);
    return this.encodeSession(newSession);
  }
}

// Export singleton instance
export const vercelSessionManager = new VercelSessionManager();