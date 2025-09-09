// Database seeding script to migrate mock data to Supabase
import { db } from './db';
import {
  properties,
  rooms,
  tenants,
  payments,
  users,
  systemSettings,
  type InsertProperty,
  type InsertRoom,
  type InsertTenant,
  type InsertPayment,
  type UpsertUser,
  type InsertSystemSetting,
} from '@shared/schema';
import { eq } from 'drizzle-orm';

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await db.delete(payments);
    await db.delete(tenants);
    await db.delete(rooms);
    await db.delete(properties);
    await db.delete(systemSettings);
    
    // Seed Users (for authentication)
    console.log('👥 Seeding users...');
    const mockUsers: UpsertUser[] = [
      {
        id: 'admin-user-001',
        email: 'admin@rentflow.com',
        firstName: 'Admin',
        lastName: 'Manager',
        role: 'landlord',
        profileImageUrl: null,
      },
      {
        id: 'caretaker-002',
        email: 'caretaker@rentflow.com',
        firstName: 'John',
        lastName: 'Caretaker',
        role: 'caretaker',
        profileImageUrl: null,
      },
      {
        id: 'tenant-003',
        email: 'tenant@rentflow.com',
        firstName: 'Jane',
        lastName: 'Tenant',
        role: 'tenant',
        profileImageUrl: null,
      },
    ];

    for (const user of mockUsers) {
      await db.insert(users).values(user).onConflictDoUpdate({
        target: users.id,
        set: { ...user, updatedAt: new Date() },
      });
    }

    // Seed Properties
    console.log('🏢 Seeding properties...');
    const mockProperty: InsertProperty = {
      name: 'Sunrise Apartments',
      totalUnits: 74,
      currency: 'KSh',
    };

    const [property] = await db.insert(properties).values(mockProperty).returning();
    console.log(`✅ Created property: ${property.name} (ID: ${property.id})`);

    // Seed Rooms (74 units)
    console.log('🏠 Seeding 74 rooms...');
    const mockRooms: InsertRoom[] = [];
    
    for (let i = 1; i <= 74; i++) {
      const floor = Math.ceil(i / 10); // 10 rooms per floor roughly
      const rentAmount = (Math.floor(Math.random() * 5) + 8) * 1000; // 8k-12k rent
      
      mockRooms.push({
        propertyId: property.id,
        roomNumber: `R${i.toString().padStart(3, '0')}`,
        floor: floor,
        rentAmount: rentAmount.toString(),
        status: Math.random() > 0.25 ? 'occupied' : 'vacant', // 75% occupancy
      });
    }

    const createdRooms = await db.insert(rooms).values(mockRooms).returning();
    console.log(`✅ Created ${createdRooms.length} rooms`);

    // Seed Tenants
    console.log('👨‍👩‍👧‍👦 Seeding tenants...');
    const occupiedRooms = createdRooms.filter(room => room.status === 'occupied');
    const tenantNames = [
      'John Doe', 'Jane Smith', 'Michael Brown', 'Sarah Wilson', 'David Johnson',
      'Emily Davis', 'James Miller', 'Lisa Garcia', 'Robert Martinez', 'Maria Rodriguez',
      'William Anderson', 'Jennifer Taylor', 'Richard Thomas', 'Linda Jackson', 'Charles White',
      'Nancy Harris', 'Christopher Martin', 'Betty Thompson', 'Daniel Garcia', 'Helen Martinez',
      'Matthew Robinson', 'Sandra Clark', 'Anthony Rodriguez', 'Donna Lewis', 'Mark Lee',
      'Carol Walker', 'Steven Hall', 'Ruth Allen', 'Paul Young', 'Sharon Hernandez',
      'Andrew King', 'Michelle Wright', 'Joshua Lopez', 'Laura Hill', 'Kenneth Scott',
      'Susan Green', 'Kevin Adams', 'Patricia Baker', 'Brian Gonzalez', 'Kimberly Nelson',
      'George Carter', 'Lisa Mitchell', 'Edward Perez', 'Mary Roberts', 'Ronald Turner',
      'Barbara Phillips', 'Timothy Campbell', 'Elizabeth Parker', 'Jason Evans', 'Linda Edwards',
      'Jeffrey Collins', 'Christine Stewart', 'Ryan Sanchez', 'Samantha Morris', 'Jacob Rogers',
      'Amy Reed', 'Gary Cook', 'Deborah Morgan', 'Nicholas Bell', 'Rachel Murphy',
    ];

    const mockTenants: InsertTenant[] = [];
    
    for (let i = 0; i < Math.min(occupiedRooms.length, tenantNames.length); i++) {
      const [firstName, lastName] = tenantNames[i].split(' ');
      const phoneNumber = `+254${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`;
      
      mockTenants.push({
        userId: null,
        roomId: occupiedRooms[i].id,
        firstName,
        lastName,
        email,
        phone: phoneNumber,
        nationalId: `${Math.floor(Math.random() * 100000000)}`,
        emergencyContact: `+254${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
        leaseStartDate: new Date(2024, Math.floor(Math.random() * 12), 1),
        leaseEndDate: new Date(2025, Math.floor(Math.random() * 12), 28),
        depositAmount: (parseInt(occupiedRooms[i].rentAmount) * 2).toString(),
        status: 'active',
      });
    }

    const createdTenants = await db.insert(tenants).values(mockTenants).returning();
    console.log(`✅ Created ${createdTenants.length} tenants`);

    // Seed Payments
    console.log('💰 Seeding payments...');
    const mockPayments: InsertPayment[] = [];
    const currentYear = new Date().getFullYear();
    const paymentStatuses = ['completed', 'pending', 'completed', 'completed', 'pending'] as const;
    const paymentMethods = ['mpesa', 'bank_transfer', 'cash'] as const;

    // Generate payments for the last 6 months
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const paymentDate = new Date();
      paymentDate.setMonth(paymentDate.getMonth() - monthOffset);
      const monthStr = paymentDate.toISOString().slice(0, 7); // YYYY-MM
      
      for (const tenant of createdTenants) {
        const room = occupiedRooms.find(r => r.id === tenant.roomId);
        if (!room) continue;

        const status = paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];
        const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        
        // Due date is 5th of each month
        const dueDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 5);
        
        // Paid date varies based on status
        let paidDate = null;
        if (status === 'completed') {
          paidDate = new Date(dueDate);
          paidDate.setDate(paidDate.getDate() + Math.floor(Math.random() * 10)); // Paid within 10 days
        }

        mockPayments.push({
          tenantId: tenant.id,
          roomId: room.id,
          amount: room.rentAmount,
          paymentMethod: method,
          paymentStatus: status,
          mpesaTransactionId: method === 'mpesa' ? `TXN${Math.random().toString(36).substr(2, 9).toUpperCase()}` : null,
          mpesaReceiptNumber: method === 'mpesa' ? `RCP${Math.random().toString(36).substr(2, 9).toUpperCase()}` : null,
          dueDate,
          paidDate,
          month: monthStr,
          year: paymentDate.getFullYear(),
          notes: status === 'pending' ? 'Payment reminder sent' : 'Payment received successfully',
        });
      }
    }

    const createdPayments = await db.insert(payments).values(mockPayments).returning();
    console.log(`✅ Created ${createdPayments.length} payments`);

    // Seed System Settings
    console.log('⚙️  Seeding system settings...');
    const systemSettingsData: InsertSystemSetting[] = [
      {
        key: 'payment_reminder_days',
        value: '3',
        description: 'Days before due date to send payment reminder',
      },
      {
        key: 'overdue_escalation_days',
        value: '7',
        description: 'Days after due date to send overdue notice',
      },
      {
        key: 'default_currency',
        value: 'KSh',
        description: 'Default currency for the system',
      },
      {
        key: 'mpesa_shortcode',
        value: '174379',
        description: 'M-Pesa business shortcode',
      },
      {
        key: 'sms_sender_id',
        value: 'RENTFLOW',
        description: 'SMS sender ID for notifications',
      },
    ];

    for (const setting of systemSettingsData) {
      await db.insert(systemSettings).values(setting).onConflictDoUpdate({
        target: systemSettings.key,
        set: { ...setting, updatedAt: new Date() },
      });
    }
    console.log(`✅ Created/updated ${systemSettingsData.length} system settings`);

    console.log('🎉 Database seeding completed successfully!');
    
    // Summary
    console.log('\n📊 SEEDING SUMMARY:');
    console.log(`• Users: ${mockUsers.length}`);
    console.log(`• Properties: 1`);
    console.log(`• Rooms: ${createdRooms.length}`);
    console.log(`• Tenants: ${createdTenants.length}`);
    console.log(`• Payments: ${createdPayments.length}`);
    console.log(`• System Settings: ${systemSettingsData.length}`);
    console.log(`• Occupancy Rate: ${((createdTenants.length / createdRooms.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('✅ Seeding process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding process failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };