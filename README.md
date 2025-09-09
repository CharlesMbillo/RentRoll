# RentFlow - Property Management Platform

A comprehensive rental property management platform designed for rent collection, tenant management, and property analytics. RentFlow provides a visual room matrix for tracking payment status across multiple units, automated payment processing through M-Pesa integration, and role-based access control.

## Features

### 🏢 Property Management
- **Visual Room Matrix**: Interactive grid view of all 74 units with color-coded status indicators
  - 🟢 Green: Paid
  - 🟡 Yellow: Pending  
  - 🔴 Red: Overdue
  - ⚪ Gray: Vacant
- **Room Assignment**: Drag-and-drop tenant assignment to rooms
- **Property Analytics**: Real-time occupancy rates and revenue tracking

### 💰 Payment Processing
- **M-Pesa Integration**: STK Push payment processing with real-time webhook updates
- **Payment Status Tracking**: Comprehensive payment history and status monitoring
- **Automated Reminders**: SMS notifications for upcoming and overdue payments

### 👥 User Management
- **Role-Based Access Control**: Three distinct user roles
  - **Landlord**: Full system access including financial reports
  - **Caretaker**: Property management with limited financial access
  - **Tenant**: Payment and notification access only
- **Secure Authentication**: JWT-based session management with production-ready security

### 📊 Dashboard & Analytics
- **Real-time Metrics**: Occupancy rates, monthly revenue, payment distribution
- **Tenant Management**: Complete CRUD operations with search and filtering
- **SMS Communication**: Template-based messaging system

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL database (or Neon account)
- M-Pesa API credentials (optional, for payment processing)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rentflow-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file with the following variables:
   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/rentflow
   
   # Authentication
   SESSION_SECRET=your-super-secret-jwt-signing-key-here
   
   # M-Pesa Integration (Optional)
   MPESA_CONSUMER_KEY=your-mpesa-consumer-key
   MPESA_CONSUMER_SECRET=your-mpesa-consumer-secret
   MPESA_PASSKEY=your-mpesa-passkey
   MPESA_SHORTCODE=your-business-shortcode
   
   # SMS Service (Optional)
   SMS_API_KEY=your-sms-provider-api-key
   SMS_SENDER_ID=your-sender-id
   ```

4. **Database Setup**
   ```bash
   # Push database schema
   npm run db:push
   
   # Optional: Reset database with sample data
   npm run db:push --force
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5000`

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** with shadcn/ui component library
- **Wouter** for lightweight routing
- **React Query (TanStack)** for server state management
- **React Hook Form** with Zod validation

### Backend
- **Node.js** with Express.js
- **TypeScript** with ES modules
- **Drizzle ORM** for type-safe database operations
- **PostgreSQL** with Neon serverless hosting
- **JWT Authentication** with secure session management
- **Express Sessions** with PostgreSQL session store

### Development Tools
- **TypeScript** for type safety
- **ESLint & Prettier** for code quality
- **Drizzle Kit** for database migrations
- **React Query DevTools** for debugging

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

## Usage

### User Roles & Access

#### Landlord/Admin
- Full access to all features
- Financial reports and analytics
- User management
- System configuration

#### Caretaker
- Property and tenant management
- Limited financial access
- Room assignments
- Communication tools

#### Tenant
- Payment processing
- Payment history
- Notification preferences
- Profile management

### Getting Started

1. **Access the Application**: Navigate to the deployed URL or local development server
2. **Role Selection**: Choose your role (landlord, caretaker, or tenant) from the landing page
3. **Dashboard Navigation**: Use the sidebar to access different features based on your role
4. **Room Matrix**: View and manage property status through the interactive room grid
5. **Tenant Management**: Add, edit, and assign tenants to rooms
6. **Payment Processing**: Process payments through M-Pesa integration

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user session
- `GET /api/login` - Redirect to login page
- `GET /api/logout` - Logout and destroy session

### Property Management
- `GET /api/properties` - List all properties
- `GET /api/rooms/:propertyId` - Get rooms for a property
- `POST /api/rooms` - Create new room

### Tenant Management
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create new tenant
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant

### Payments
- `GET /api/payments` - List payments
- `POST /api/payments` - Create payment
- `POST /api/mpesa/stk-push` - Initiate M-Pesa payment

### Dashboard
- `GET /api/dashboard/metrics` - Get dashboard analytics

## Deployment

### Environment Variables for Production

Ensure these environment variables are set in your production environment:

```env
DATABASE_URL=your-production-database-url
SESSION_SECRET=your-production-jwt-secret
NODE_ENV=production
VERCEL=1  # If deploying to Vercel
```

### Vercel Deployment

1. **Connect Repository**: Link your Git repository to Vercel
2. **Environment Variables**: Add all required environment variables in Vercel dashboard
3. **Build Settings**: Vercel will automatically detect the build configuration
4. **Database**: Ensure your production database is accessible from Vercel

### Manual Deployment

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Database Migration**
   ```bash
   npm run db:push
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

## Database Schema

The application uses the following core tables:

- **users**: User accounts with role-based permissions
- **properties**: Property information and settings
- **rooms**: Individual room/unit data with status tracking
- **tenants**: Tenant information and contact details
- **payments**: Payment records with status and audit trail
- **sessions**: Secure session storage for authentication

## Security Features

- **JWT Authentication**: Secure token-based authentication with signature verification
- **Role-Based Access**: Granular permissions based on user roles
- **Session Management**: Secure session handling with automatic expiration
- **Input Validation**: Comprehensive request validation using Zod schemas
- **SQL Injection Protection**: Parameterized queries through Drizzle ORM

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `/docs` (if available)
- Review the API documentation for endpoint details