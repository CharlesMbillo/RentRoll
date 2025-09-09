// Deployment authentication testing utilities
import { vercelSessionManager } from './vercel-session-manager';
import jwt from 'jsonwebtoken';

export class AuthDeploymentTester {
  
  static async testJWTSigning(): Promise<{
    success: boolean;
    message: string;
    jwtToken?: string;
    decodedData?: any;
    error?: string;
  }> {
    try {
      console.log('🧪 TESTING JWT SIGNING FOR DEPLOYMENT...');
      
      // Test 1: Verify SESSION_SECRET exists
      const secret = process.env.SESSION_SECRET;
      if (!secret) {
        return {
          success: false,
          message: 'SESSION_SECRET environment variable is missing',
          error: 'Missing required environment variable'
        };
      }
      
      console.log('✅ SESSION_SECRET found');
      
      // Test 2: Create a test session
      const testSession = vercelSessionManager.createSession('landlord');
      console.log('✅ Test session created');
      
      // Test 3: Encode session to JWT
      const jwtToken = vercelSessionManager.encodeSession(testSession);
      console.log('✅ JWT token generated');
      
      // Test 4: Decode and verify JWT
      const decodedSession = vercelSessionManager.decodeSession(jwtToken);
      
      if (!decodedSession) {
        return {
          success: false,
          message: 'JWT token verification failed',
          jwtToken,
          error: 'Token decode returned null'
        };
      }
      
      console.log('✅ JWT token verified');
      
      // Test 5: Validate decoded data
      if (decodedSession.role !== 'landlord' || 
          decodedSession.userId !== 'admin-user-001' ||
          !decodedSession.isActive) {
        return {
          success: false,
          message: 'Decoded JWT data validation failed',
          jwtToken,
          decodedData: decodedSession,
          error: 'Invalid token payload'
        };
      }
      
      console.log('✅ JWT payload validated');
      
      // Test 6: Test token tampering detection
      const tamperedToken = jwtToken.slice(0, -5) + 'AAAAA';
      const tamperedResult = vercelSessionManager.decodeSession(tamperedToken);
      
      if (tamperedResult !== null) {
        return {
          success: false,
          message: 'JWT tampering detection failed - security vulnerability!',
          error: 'Tampered token was accepted'
        };
      }
      
      console.log('✅ JWT tampering detection working');
      
      return {
        success: true,
        message: 'All JWT signing and verification tests passed',
        jwtToken,
        decodedData: {
          role: decodedSession.role,
          userId: decodedSession.userId,
          email: decodedSession.email,
          isActive: decodedSession.isActive,
          expiresAt: decodedSession.expiresAt
        }
      };
      
    } catch (error) {
      console.error('❌ JWT testing failed:', error);
      return {
        success: false,
        message: 'JWT testing encountered an error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  static async testEnvironmentCompatibility(): Promise<{
    success: boolean;
    environment: string;
    sessionManager: string;
    secretAvailable: boolean;
    jwtLibraryLoaded: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check environment detection
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const environment = isVercel ? 'production/vercel' : 'development';
    const sessionManager = isVercel ? 'VercelSessionManager (JWT)' : 'SessionManager (Memory)';
    
    // Check SESSION_SECRET
    const secretAvailable = !!process.env.SESSION_SECRET;
    if (!secretAvailable) {
      issues.push('SESSION_SECRET environment variable not found');
    }
    
    // Check JWT library
    let jwtLibraryLoaded = false;
    try {
      jwtLibraryLoaded = typeof jwt.sign === 'function' && typeof jwt.verify === 'function';
    } catch {
      issues.push('JWT library not properly loaded');
    }
    
    // Production-specific checks
    if (isVercel) {
      if (!secretAvailable) {
        issues.push('Production environment requires SESSION_SECRET');
      }
      if (!jwtLibraryLoaded) {
        issues.push('Production environment requires JWT library');
      }
    }
    
    return {
      success: issues.length === 0,
      environment,
      sessionManager,
      secretAvailable,
      jwtLibraryLoaded,
      issues
    };
  }
  
  static async generateDeploymentReport(): Promise<string> {
    const jwtTest = await this.testJWTSigning();
    const envTest = await this.testEnvironmentCompatibility();
    
    const report = `
# Authentication Deployment Readiness Report
Generated: ${new Date().toISOString()}

## Environment Status
- **Environment**: ${envTest.environment}
- **Session Manager**: ${envTest.sessionManager}  
- **SESSION_SECRET**: ${envTest.secretAvailable ? '✅ Available' : '❌ Missing'}
- **JWT Library**: ${envTest.jwtLibraryLoaded ? '✅ Loaded' : '❌ Missing'}

## JWT Signing Test
- **Status**: ${jwtTest.success ? '✅ PASSED' : '❌ FAILED'}
- **Message**: ${jwtTest.message}

${jwtTest.jwtToken ? `- **Sample JWT**: ${jwtTest.jwtToken.substring(0, 50)}...` : ''}

${jwtTest.error ? `- **Error**: ${jwtTest.error}` : ''}

## Issues Found
${envTest.issues.length > 0 ? envTest.issues.map(issue => `- ❌ ${issue}`).join('\n') : '✅ No issues found'}

## Deployment Recommendations
${envTest.success && jwtTest.success ? 
  '🎉 System is ready for production deployment!' : 
  '⚠️  Issues must be resolved before deployment:'}

${!envTest.secretAvailable ? '- Add SESSION_SECRET environment variable to production' : ''}
${!jwtTest.success ? '- Fix JWT signing/verification issues' : ''}
${envTest.issues.length > 0 ? '- Resolve environment compatibility issues' : ''}

## Test Commands for Deployment
\`\`\`bash
# Test production environment locally
NODE_ENV=production VERCEL=1 curl "http://localhost:5000/api/auth/user?role=landlord"

# Verify JWT tokens in production
NODE_ENV=production VERCEL=1 curl "http://localhost:5000/api/auth/user?role=caretaker"
\`\`\`
`;

    return report.trim();
  }
}