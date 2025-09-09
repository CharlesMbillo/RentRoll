import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure secure PostgreSQL connection for Supabase
const connectionString = process.env.DATABASE_URL;

// Create connection with security and performance optimizations
const client = postgres(connectionString, {
  // Security configurations
  ssl: process.env.NODE_ENV === 'production' ? 'require' : 'prefer',
  
  // Connection pooling for optimal performance
  max: 20, // Maximum number of connections in pool
  idle_timeout: 20, // Close connections after 20 seconds of inactivity
  connect_timeout: 10, // Connection timeout in seconds
  
  // Performance optimizations
  prepare: false, // Disable prepared statements for serverless compatibility
  
  // Error handling
  onnotice: () => {}, // Suppress PostgreSQL notices in production
  
  // Development vs Production settings
  ...(process.env.NODE_ENV === 'production' ? {
    // Production optimizations
    transform: {
      undefined: null, // Transform undefined to null for PostgreSQL compatibility
    },
  } : {
    // Development settings
    debug: false, // Set to true for SQL debugging
  })
});

// Create Drizzle database instance with schema
export const db = drizzle(client, { schema });

// Connection health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await client.end();
  console.log('🔌 Database connection closed gracefully');
});