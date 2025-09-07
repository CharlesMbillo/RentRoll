# RentFlow - Role-Based Test Credentials

## Available Test User Roles

### 🔑 **ADMIN/LANDLORD** (Default)
```json
{
  "id": "admin-user-001",
  "email": "admin@rentflow.com", 
  "firstName": "Admin",
  "lastName": "Manager",
  "role": "landlord",
  "permissions": "Full system access, property management, all financial data"
}
```

### 👷 **CARETAKER**
```json
{
  "id": "caretaker-002",
  "email": "caretaker@rentflow.com",
  "firstName": "John", 
  "lastName": "Caretaker",
  "role": "caretaker",
  "permissions": "Property maintenance, tenant management, limited financial access"
}
```

### 🏠 **TENANT**
```json
{
  "id": "tenant-003", 
  "email": "tenant@rentflow.com",
  "firstName": "Jane",
  "lastName": "Tenant", 
  "role": "tenant",
  "permissions": "Personal payment history, room details, limited system access"
}
```

## How to Test Role-Based Access

### Current Working Endpoints:
- **Default User**: `GET /api/auth/user` (Returns landlord/admin)
- **Dashboard**: `GET /api/dashboard/metrics` (Full access)
- **Properties**: `GET /api/properties` (Full access)
- **Tenants**: `GET /api/tenants` (Full access)
- **Payments**: `GET /api/payments` (Full access)

### Authentication Status:
✅ **Database**: Connected and functional  
✅ **Mock Authentication**: Active (development mode)  
❌ **M-Pesa Integration**: Missing API keys  
❌ **SMS Integration**: Missing API keys  

## Test Commands:
```bash
# Test current user (landlord)
curl http://localhost:5000/api/auth/user

# Test dashboard access
curl http://localhost:5000/api/dashboard/metrics  

# Test property access
curl http://localhost:5000/api/properties
```

## Role Implementation Status:
- ✅ **Schema**: Supports landlord, caretaker, tenant roles
- ⚠️ **Authentication**: Currently fixed to landlord role  
- 🔄 **Dynamic Switching**: In development
- ✅ **Database**: Role field implemented
- ✅ **Frontend**: Role-based UI components ready