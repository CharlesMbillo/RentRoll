import { db } from "./db";
import { properties, rooms, tenants, payments, users } from "@shared/schema";
import { sql } from "drizzle-orm";

// Local tenant names for seeding
const localTenantNames = [
  "James Kamau", "Mary Wanjiku", "Peter Mwangi", "Grace Nyambura", "John Kiprotich",
  "Sarah Achieng", "David Waweru", "Faith Njeri", "Samuel Ochieng", "Rose Wanjiru",
  "Michael Kiprop", "Lucy Waithera", "Daniel Otieno", "Jane Muthoni", "Kevin Mutua",
  "Esther Akinyi", "Robert Kosgei", "Mercy Njoki", "Philip Kamunge", "Agnes Wangari",
  "Francis Kibet", "Susan Wambui", "Joseph Karanja", "Catherine Adhiambo", "Emmanuel Ruto",
  "Margaret Njoroge", "Thomas Muchiri", "Beatrice Chepkemoi", "Charles Maina", "Joyce Waceke",
  "Anthony Musyoka", "Naomi Chebet", "Isaac Wamae", "Salome Nyawira", "Benjamin Kiptoo",
  "Lydia Wangeci", "Stephen Kiprotich", "Monica Akoth", "Andrew Mbugua", "Priscilla Jelimo",
  "Henry Wamalwa", "Alice Wanjiru", "Simon Kemboi", "Elizabeth Njambi", "Victor Onyango",
  "Rebecca Kinya", "Moses Cheruiyot", "Violet Wangui", "Felix Ouma", "Teresa Mwende",
  "Paul Macharia", "Gladys Chepchirchir", "Edwin Wafula", "Helen Gathoni", "Mark Kiplagat",
  "Janet Wambua", "Geoffrey Langat", "Christine Wairumu", "Lawrence Omondi", "Eunice Wairimu",
  "Brian Kipchumba", "Stella Mukiri", "Nicholas Mutiso", "Diana Aoko", "Collins Rotich",
  "Linda Wamaitha", "Alex Machoka", "Winnie Chepkorir", "Ryan Kamotho", "Doris Wairimu",
  "Ivan Kiplimo", "Pauline Waiguru", "Oscar Wekesa", "Mercy Wanjiku"
];

// Phone numbers for tenants (Kenyan format)
const generatePhoneNumber = (index: number): string => {
  const prefixes = ['0701', '0702', '0703', '0705', '0706', '0707', '0708', '0722', '0723', '0724', '0725'];
  const prefix = prefixes[index % prefixes.length];
  const suffix = (100000 + (index * 1234) % 900000).toString();
  return prefix + suffix;
};

export async function seedDatabase() {
  console.log("Starting database seeding...");

  try {
    // Clear existing data
    await db.delete(payments);
    await db.delete(tenants);
    await db.delete(rooms);
    await db.delete(properties);
    
    console.log("Cleared existing data");

    // Create main property
    const [property] = await db.insert(properties).values({
      name: "RentFlow Apartments",
      totalUnits: 74,
    }).returning();

    console.log("Created property:", property.name);

    // Create rooms with proper numbering
    const roomsData = [];
    const floorLetters = ['A', 'B', 'C']; // Ground, First, Second floors
    
    for (let floor = 0; floor < 3; floor++) {
      const unitsPerFloor = floor === 2 ? 24 : 25; // Top floor has 24 units
      
      for (let unit = 1; unit <= unitsPerFloor; unit++) {
        const roomNumber = `${floorLetters[floor]}${unit.toString().padStart(2, '0')}`;
        roomsData.push({
          propertyId: property.id,
          roomNumber,
          floor: floor + 1, // 1-indexed for display
          rentAmount: (15000 + (Math.floor(Math.random() * 5) * 1000)).toString(), // 15k-20k rent
          status: "vacant" as const,
        });
      }
    }

    const createdRooms = await db.insert(rooms).values(roomsData).returning();
    console.log(`Created ${createdRooms.length} rooms`);

    // Create tenants and assign to rooms
    const tenantsData = [];
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentYear = new Date().getFullYear();
    const now = new Date();
    
    // Assign 55 of the 74 units (about 74% occupancy)
    const occupiedRooms = createdRooms.slice(0, 55);
    
    for (let i = 0; i < occupiedRooms.length && i < localTenantNames.length; i++) {
      const room = occupiedRooms[i];
      const fullName = localTenantNames[i];
      const [firstName, ...lastNameParts] = fullName.split(' ');
      const lastName = lastNameParts.join(' ');
      
      tenantsData.push({
        roomId: room.id,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@gmail.com`,
        phone: generatePhoneNumber(i),
        nationalId: `${20000000 + i}`,
        status: "active" as const,
        leaseStartDate: new Date(2024, 0, 1), // Started Jan 2024
        leaseEndDate: new Date(2024, 11, 31), // Ends Dec 2024
        depositAmount: (parseInt(room.rentAmount) * 2).toString(), // 2 months deposit
      });
    }

    const createdTenants = await db.insert(tenants).values(tenantsData).returning();
    console.log(`Created ${createdTenants.length} tenants`);

    // Update room status to occupied for assigned rooms
    for (const tenant of createdTenants) {
      await db.update(rooms)
        .set({ status: "occupied" })
        .where(sql`id = ${tenant.roomId}`);
    }

    // Create payment records for current month
    const paymentsData = [];
    const statusWeights = [0.6, 0.25, 0.15]; // 60% paid, 25% pending, 15% overdue
    
    for (const tenant of createdTenants) {
      const room = occupiedRooms.find(r => r.id === tenant.roomId);
      if (!room) continue;
      
      // Determine payment status
      const random = Math.random();
      let status: "completed" | "pending" = "pending";
      
      if (random <= statusWeights[0]) {
        status = "completed";
      } else {
        status = "pending";
      }
      
      // Set due date and payment date
      const dueDate = new Date(currentYear, new Date().getMonth(), 5); // 5th of current month
      let paidDate = null;
      
      if (status === "completed") {
        // Paid between 1-10 days of the month
        paidDate = new Date(currentYear, new Date().getMonth(), Math.floor(Math.random() * 10) + 1);
      }
      
      paymentsData.push({
        tenantId: tenant.id,
        roomId: room.id,
        amount: room.rentAmount,
        month: currentMonth,
        year: currentYear,
        dueDate,
        paidDate,
        paymentStatus: status,
        paymentMethod: status === "completed" ? "mpesa" as const : "mpesa",
        mpesaTransactionId: status === "completed" ? `MP${Date.now()}${Math.floor(Math.random() * 1000)}` : undefined,
      });
    }

    const createdPayments = await db.insert(payments).values(paymentsData).returning();
    console.log(`Created ${createdPayments.length} payment records`);

    console.log("✅ Database seeding completed successfully!");
    console.log(`- Property: ${property.name}`);
    console.log(`- Rooms: ${createdRooms.length} total (${createdTenants.length} occupied, ${createdRooms.length - createdTenants.length} vacant)`);
    console.log(`- Tenants: ${createdTenants.length} active`);
    console.log(`- Payments: ${createdPayments.length} for current month`);
    
    return {
      property,
      rooms: createdRooms,
      tenants: createdTenants,
      payments: createdPayments,
    };
    
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}