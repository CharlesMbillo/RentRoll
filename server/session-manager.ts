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

export class SessionManager {
  private sessions: Map<string, UserSession> = new Map();
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

    this.sessions.set(sessionId, session);
    console.log(`🔐 SESSION CREATED: ${sessionId} for ${role} (${mockUser.firstName} ${mockUser.lastName})`);
    return session;
  }

  getSession(sessionId: string): UserSession | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date() > session.expiresAt || !session.isActive) {
      this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`🔐 SESSION DESTROYED: ${sessionId} for ${session.role} (${session.firstName} ${session.lastName})`);
      return this.sessions.delete(sessionId);
    }
    return false;
  }

  switchRole(sessionId: string, newRole: 'landlord' | 'caretaker' | 'tenant'): UserSession | null {
    const existingSession = this.sessions.get(sessionId);
    if (existingSession) {
      // Destroy the old session
      this.destroySession(sessionId);
    }
    
    // Create new session with the new role
    return this.createSession(newRole);
  }

  validateSession(sessionId: string): boolean {
    return this.getSession(sessionId) !== null;
  }

  getUserFromSession(sessionId: string) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    return {
      id: session.userId,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
      role: session.role,
      profileImageUrl: session.profileImageUrl,
      createdAt: session.createdAt,
      updatedAt: session.createdAt,
    };
  }

  // Clean up expired sessions
  cleanupExpiredSessions(): void {
    const now = new Date();
    const sessionEntries = Array.from(this.sessions.entries());
    for (const [sessionId, session] of sessionEntries) {
      if (now > session.expiresAt || !session.isActive) {
        this.destroySession(sessionId);
      }
    }
  }

  // Get active session count for monitoring
  getActiveSessionCount(): number {
    this.cleanupExpiredSessions();
    return this.sessions.size;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Cleanup expired sessions every 30 minutes
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 30 * 60 * 1000);