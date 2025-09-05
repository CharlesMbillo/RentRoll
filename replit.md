# Replit.md

## Overview

RentFlow is a comprehensive property management platform designed for rent collection and tenant management. The system provides a visual room matrix for tracking payment status across 74 units, automated payment processing through M-Pesa integration, tenant management, and analytics dashboard. The platform features role-based authentication supporting landlord, caretaker, and tenant roles, with real-time status tracking and automated notification systems.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent UI patterns
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (TanStack Query) for server state and API caching
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Authentication**: Session-based authentication integrated with Replit Auth system

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with OpenID Connect strategy for Replit integration
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful endpoints with standardized error handling

### Database Design
- **Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Core Tables**: 
  - Users with role-based access (landlord, caretaker, tenant)
  - Properties and rooms with hierarchical relationship
  - Tenants with room assignments and contact information
  - Payments with status tracking and audit trail
  - SMS notifications for communication history
  - System settings for configuration management

### Key Features Implementation
- **Room Matrix**: Interactive 74-unit grid with color-coded status indicators (Green=Paid, Yellow=Pending, Red=Overdue, Gray=Vacant)
- **Payment Processing**: M-Pesa STK Push integration with webhook handling for real-time payment updates
- **Notification System**: SMS-based reminders with configurable timing (3-day advance, 7-day overdue escalation)
- **Dashboard Analytics**: Real-time metrics including occupancy rates, revenue tracking, and payment status distribution
- **Tenant Management**: Complete CRUD operations with search, filtering, and relationship management

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Authentication & Security
- **Replit Auth**: OpenID Connect integration for user authentication
- **Passport.js**: Authentication middleware with OpenID strategy
- **express-session**: Session management with secure cookie handling

### Payment Integration
- **M-Pesa API**: Mobile money payment processing with STK Push functionality
- **Webhook handling**: Real-time payment status updates and reconciliation

### Communication Services
- **SMS Provider Integration**: Configurable SMS service for automated notifications
- **Template-based messaging**: Payment reminders, overdue notices, and system alerts

### UI & Styling Framework
- **shadcn/ui**: Component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Radix UI**: Headless UI components for accessibility and customization

### Development Tools
- **Vite**: Fast development server and build tool with HMR support
- **TypeScript**: Type safety across frontend and backend
- **Drizzle Kit**: Database migration and schema management tools
- **React Query DevTools**: Development debugging for API state management