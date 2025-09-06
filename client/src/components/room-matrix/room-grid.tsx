import { useMemo } from "react";
import RoomCell from "./room-cell";

interface RoomGridProps {
  searchTerm: string;
  statusFilter: string;
  floorFilter: string;
}

interface Room {
  id: number;
  roomNumber: string;
  status: "paid" | "pending" | "overdue" | "vacant";
  floor: number;
  tenant?: string;
}

// Local tenant names for realistic data
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

// Generate local room data with proper numbering system
const generateRoomData = (): Room[] => {
  const rooms: Room[] = [];
  const statuses: Array<"paid" | "pending" | "overdue" | "vacant"> = ["paid", "pending", "overdue", "vacant"];
  const statusWeights = [0.47, 0.20, 0.12, 0.21]; // 47% paid, 20% pending, 12% overdue, 21% vacant
  const floorLetters = ['A', 'B', 'C']; // Ground, First, Second floors

  function getRandomStatus(): "paid" | "pending" | "overdue" | "vacant" {
    const random = Math.random();
    let cumulativeWeight = 0;
    for (let i = 0; i < statusWeights.length; i++) {
      cumulativeWeight += statusWeights[i];
      if (random <= cumulativeWeight) {
        return statuses[i];
      }
    }
    return statuses[0];
  }

  function getRandomTenant(): string {
    const randomIndex = Math.floor(Math.random() * localTenantNames.length);
    return localTenantNames[randomIndex];
  }

  let tenantIndex = 0;
  
  for (let floor = 0; floor < 3; floor++) {
    const unitsPerFloor = floor === 2 ? 24 : 25; // Top floor has 24 units
    
    for (let unit = 1; unit <= unitsPerFloor; unit++) {
      const roomNumber = `${floorLetters[floor]}${unit.toString().padStart(2, '0')}`;
      const status = getRandomStatus();
      let tenant = undefined;
      
      if (status !== "vacant" && tenantIndex < localTenantNames.length) {
        tenant = localTenantNames[tenantIndex];
        tenantIndex++;
      }
      
      rooms.push({
        id: floor * 25 + unit,
        roomNumber,
        status,
        floor,
        tenant,
      });
    }
  }

  return rooms;
};

export default function RoomGrid({ searchTerm, statusFilter, floorFilter }: RoomGridProps) {
  const rooms = useMemo(() => generateRoomData(), []);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch = searchTerm === "" || 
        room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || room.status === statusFilter;
      
      const matchesFloor = floorFilter === "all" || room.floor.toString() === floorFilter;

      return matchesSearch && matchesStatus && matchesFloor;
    });
  }, [rooms, searchTerm, statusFilter, floorFilter]);

  return (
    <div 
      className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-2"
      data-testid="room-grid"
    >
      {filteredRooms.map((room) => (
        <RoomCell
          key={room.id}
          roomNumber={room.roomNumber}
          status={room.status}
          tenant={room.tenant}
        />
      ))}
    </div>
  );
}
