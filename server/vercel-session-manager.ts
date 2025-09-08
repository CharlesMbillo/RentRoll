import { randomUUID } from 'crypto';

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

  // For serverless, we encode session data in the token itself
  encodeSession(session: UserSession): string {
    const sessionData = {
      id: session.id,
      userId: session.userId,
      role: session.role,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
      profileImageUrl: session.profileImageUrl,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isActive: session.isActive
    };
    
    // Simple base64 encoding for serverless (in production, use proper JWT)
    return Buffer.from(JSON.stringify(sessionData)).toString('base64');
  }

  decodeSession(encodedSession: string): UserSession | null {
    try {
      const sessionData = JSON.parse(Buffer.from(encodedSession, 'base64').toString());
      
      // Check if session has expired
      const expiresAt = new Date(sessionData.expiresAt);
      if (new Date() > expiresAt || !sessionData.isActive) {
        return null;
      }

      return {
        ...sessionData,
        createdAt: new Date(sessionData.createdAt),
        expiresAt: expiresAt
      };
    } catch (error) {
      console.error('Failed to decode session:', error);
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
    // In serverless environment, we can't really destroy sessions
    // Client should remove the session token
    return true;
  }

  switchRole(sessionId: string, newRole: 'landlord' | 'caretaker' | 'tenant'): UserSession {
    // Create new session with the new role
    return this.createSession(newRole);
  }
}

// Export singleton instance
export const vercelSessionManager = new VercelSessionManager();