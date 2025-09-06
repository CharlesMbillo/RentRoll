import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import RoomCell from "./room-cell";

interface RoomGridProps {
  searchTerm: string;
  statusFilter: string;
  floorFilter: string;
}

interface Room {
  id: string;
  roomNumber: string;
  status: "paid" | "pending" | "overdue" | "vacant";
  floor: number;
  tenant?: string;
}

// Helper function to determine room payment status
const getRoomStatus = (room: any, tenants: any[], payments: any[]): "paid" | "pending" | "overdue" | "vacant" => {
  if (room.status === "vacant") return "vacant";
  
  // Find tenant for this room
  const tenant = tenants.find(t => t.roomId === room.id);
  if (!tenant) return "vacant";
  
  // Find current month payment for this room
  const currentMonth = new Date().toISOString().slice(0, 7);
  const payment = payments.find(p => p.roomId === room.id && p.month === currentMonth);
  
  if (!payment) return "pending";
  
  if (payment.paymentStatus === "completed") return "paid";
  
  // Check if overdue (past due date)
  const now = new Date();
  const dueDate = new Date(payment.dueDate);
  if (dueDate < now) return "overdue";
  
  return "pending";
};

export default function RoomGrid({ searchTerm, statusFilter, floorFilter }: RoomGridProps) {
  // Fetch rooms data from API
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['/api/rooms/all'],
    queryFn: async () => {
      // Get the first property (we assume single property setup)
      const propertiesResponse = await fetch('/api/properties');
      const properties = await propertiesResponse.json();
      
      if (properties.length === 0) return [];
      
      const roomsResponse = await fetch(`/api/rooms/${properties[0].id}`);
      return roomsResponse.json();
    },
  });

  // Fetch tenants data
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<any[]>({
    queryKey: ['/api/tenants'],
  });

  // Fetch payments data
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<any[]>({
    queryKey: ['/api/payments'],
  });

  // Transform backend data to frontend format
  const transformedRooms = useMemo(() => {
    if (roomsLoading || tenantsLoading || paymentsLoading) return [];
    
    return rooms.map((room: any): Room => {
      const tenant = (tenants as any[]).find((t: any) => t.roomId === room.id);
      const status = getRoomStatus(room, tenants as any[], payments as any[]);
      
      return {
        id: room.id,
        roomNumber: room.roomNumber,
        status,
        floor: room.floor || 1,
        tenant: tenant ? `${tenant.firstName} ${tenant.lastName}` : undefined,
      };
    });
  }, [rooms, tenants, payments, roomsLoading, tenantsLoading, paymentsLoading]);

  const filteredRooms = useMemo(() => {
    return transformedRooms.filter((room: Room) => {
      const matchesSearch = searchTerm === "" || 
        room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (room.tenant && room.tenant.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || room.status === statusFilter;
      
      const matchesFloor = floorFilter === "all" || room.floor.toString() === floorFilter;

      return matchesSearch && matchesStatus && matchesFloor;
    });
  }, [transformedRooms, searchTerm, statusFilter, floorFilter]);

  if (roomsLoading || tenantsLoading || paymentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading room data...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-2"
      data-testid="room-grid"
    >
      {filteredRooms.map((room: Room) => (
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
