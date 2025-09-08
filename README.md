# RentFlow - Property Management Platform

A comprehensive property management platform with automated rent collection, tenant management, and real-time analytics.

## Features

- **Room Matrix Visualization**: Interactive 74-unit grid with color-coded status indicators
- **M-Pesa Payment Integration**: Automated payment processing with real-time updates
- **Role-Based Authentication**: Separate access for landlords, caretakers, and tenants
- **Real-Time Dashboard**: Occupancy rates, revenue tracking, and payment analytics
- **SMS Notifications**: Automated reminders and overdue escalation system
- **Tenant Management**: Complete CRUD operations with search and filtering

## Deployment Options

### Vercel Deployment

This project is configured for deployment on Vercel:

1. **Fork/Clone this repository**
2. **Connect to Vercel**: Import your repository in the Vercel dashboard
3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   DATABASE_URL=your_postgres_connection_string
   SESSION_SECRET=your_secure_session_secret
   ```
4. **Deploy**: Vercel will automatically build and deploy your application

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   cd client && npm install
   ```

2. **Set up environment variables** (copy `.env.example` to `.env`)

3. **Run development server**:
   ```bash
   npm run dev
   ```

## Authentication System

The platform includes a flexible authentication system:

- **Development Mode**: Role-based testing with predefined users (Landlord, Caretaker, Tenant)
- **Demo Login**: Simple login form with test credentials
- **Session Management**: Secure session-based authentication with localStorage persistence

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Vercel-ready with automatic builds
- **Authentication**: Session-based with role management

## Project Structure

```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Application pages
│   │   └── hooks/       # Custom React hooks
├── server/           # Express backend
│   ├── api-routes.ts    # API route definitions
│   ├── session-manager.ts # Session management
│   └── index.ts         # Server entry point
├── shared/           # Shared types and schemas
└── api/              # Vercel serverless functions
```

## Getting Started

Visit the deployed application and:

1. **Choose Demo Login** for a quick test with predefined credentials
2. **Select Your Role** to test different permission levels:
   - **Landlord/Admin**: Full system access
   - **Caretaker**: Property maintenance and tenant management
   - **Tenant**: Personal payment history and room details

## Support

For issues or questions, please check the documentation or create an issue in the repository.