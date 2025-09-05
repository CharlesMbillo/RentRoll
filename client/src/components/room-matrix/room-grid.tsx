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

// Generate mock room data for demonstration
const generateRoomData = (): Room[] => {
  const rooms: Room[] = [];
  const statuses: Array<"paid" | "pending" | "overdue" | "vacant"> = ["paid", "pending", "overdue", "vacant"];
  const statusWeights = [0.7, 0.16, 0.11, 0.11]; // 70% paid, 16% pending, 11% overdue, 11% vacant

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

  for (let i = 1; i <= 74; i++) {
    const floor = Math.floor((i - 1) / 25); // Distribute across 3 floors
    const roomNumber = i.toString().padStart(2, '0');
    const status = getRandomStatus();
    
    rooms.push({
      id: i,
      roomNumber,
      status,
      floor,
      tenant: status === "vacant" ? undefined : `Tenant ${i}`,
    });
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
