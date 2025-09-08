import { storage } from './storage';
import type { Tenant, Room } from '@shared/schema';

export interface TenantAssignment {
  tenantId: string;
  roomId: string;
  assignedAt: Date;
  assignedBy?: string;
}

export interface AssignmentHistory {
  id: string;
  tenantId: string;
  roomId: string;
  assignedAt: Date;
  unassignedAt?: Date;
  assignedBy?: string;
  reason?: string;
}

export class TenantAssignmentService {
  
  /**
   * Assign a tenant to a specific room
   */
  async assignTenantToRoom(tenantId: string, roomId: string, assignedBy?: string): Promise<boolean> {
    try {
      console.log(`🏠 ASSIGNING TENANT: ${tenantId} to room ${roomId}`);
      
      // Check if tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        throw new Error(`Tenant with ID ${tenantId} not found`);
      }

      // Check if room exists and is available
      const room = await storage.getRoom(roomId);
      if (!room) {
        throw new Error(`Room with ID ${roomId} not found`);
      }

      if (room.status === 'occupied') {
        throw new Error(`Room ${roomId} is already occupied`);
      }

      // If tenant is already assigned to another room, unassign first
      if (tenant.roomId) {
        await this.unassignTenantFromRoom(tenantId, 'Reassigned to new room');
      }

      // Update tenant with new room assignment
      const updatedTenant = await storage.updateTenant(tenantId, { 
        roomId: roomId,
        updatedAt: new Date()
      });

      console.log(`✅ TENANT ASSIGNMENT SUCCESS: ${tenant.firstName} ${tenant.lastName} assigned to room ${roomId}`);
      return !!updatedTenant;
      
    } catch (error) {
      console.error(`❌ TENANT ASSIGNMENT FAILED:`, error);
      throw error;
    }
  }

  /**
   * Unassign a tenant from their current room
   */
  async unassignTenantFromRoom(tenantId: string, reason?: string): Promise<boolean> {
    try {
      console.log(`🏠 UNASSIGNING TENANT: ${tenantId}, reason: ${reason || 'No reason provided'}`);
      
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        throw new Error(`Tenant with ID ${tenantId} not found`);
      }

      if (!tenant.roomId) {
        console.log(`⚠️ TENANT NOT ASSIGNED: ${tenantId} has no room assignment`);
        return false;
      }

      const oldRoomId = tenant.roomId;

      // Update tenant to remove room assignment
      const updatedTenant = await storage.updateTenant(tenantId, { 
        roomId: null,
        updatedAt: new Date()
      });

      console.log(`✅ TENANT UNASSIGNMENT SUCCESS: ${tenant.firstName} ${tenant.lastName} unassigned from room ${oldRoomId}`);
      return !!updatedTenant;
      
    } catch (error) {
      console.error(`❌ TENANT UNASSIGNMENT FAILED:`, error);
      throw error;
    }
  }

  /**
   * Get all tenants assigned to rooms
   */
  async getAssignedTenants(): Promise<(Tenant & { room?: Room })[]> {
    try {
      const tenants = await storage.getTenants();
      const assignedTenants = tenants.filter(t => t.roomId);
      
      // Enrich with room information
      const enrichedTenants = await Promise.all(
        assignedTenants.map(async (tenant) => {
          if (tenant.roomId) {
            const room = await storage.getRoom(tenant.roomId);
            return { ...tenant, room };
          }
          return tenant;
        })
      );

      return enrichedTenants;
    } catch (error) {
      console.error('Error fetching assigned tenants:', error);
      throw error;
    }
  }

  /**
   * Get all unassigned tenants
   */
  async getUnassignedTenants(): Promise<Tenant[]> {
    try {
      const tenants = await storage.getTenants();
      return tenants.filter(t => !t.roomId);
    } catch (error) {
      console.error('Error fetching unassigned tenants:', error);
      throw error;
    }
  }

  /**
   * Get available rooms for assignment
   */
  async getAvailableRooms(): Promise<Room[]> {
    try {
      const rooms = await storage.getRooms();
      return rooms.filter(r => r.status === 'vacant');
    } catch (error) {
      console.error('Error fetching available rooms:', error);
      throw error;
    }
  }

  /**
   * Get occupancy summary
   */
  async getOccupancySummary(): Promise<{
    totalRooms: number;
    occupiedRooms: number;
    vacantRooms: number;
    occupancyRate: number;
    assignedTenants: number;
    unassignedTenants: number;
  }> {
    try {
      const [rooms, tenants] = await Promise.all([
        storage.getRooms(),
        storage.getTenants()
      ]);

      const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
      const vacantRooms = rooms.filter(r => r.status === 'vacant').length;
      const totalRooms = rooms.length;
      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
      
      const assignedTenants = tenants.filter(t => t.roomId).length;
      const unassignedTenants = tenants.filter(t => !t.roomId).length;

      return {
        totalRooms,
        occupiedRooms,
        vacantRooms,
        occupancyRate: Number(occupancyRate.toFixed(2)),
        assignedTenants,
        unassignedTenants
      };
    } catch (error) {
      console.error('Error generating occupancy summary:', error);
      throw error;
    }
  }

  /**
   * Bulk assign multiple tenants to rooms
   */
  async bulkAssignTenants(assignments: TenantAssignment[]): Promise<{
    successful: string[];
    failed: { tenantId: string; roomId: string; error: string }[];
  }> {
    const successful: string[] = [];
    const failed: { tenantId: string; roomId: string; error: string }[] = [];

    for (const assignment of assignments) {
      try {
        await this.assignTenantToRoom(
          assignment.tenantId, 
          assignment.roomId, 
          assignment.assignedBy
        );
        successful.push(assignment.tenantId);
      } catch (error) {
        failed.push({
          tenantId: assignment.tenantId,
          roomId: assignment.roomId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`📊 BULK ASSIGNMENT COMPLETE: ${successful.length} successful, ${failed.length} failed`);
    return { successful, failed };
  }

  /**
   * Find optimal room assignments based on preferences or criteria
   */
  async suggestRoomAssignments(): Promise<{
    tenantId: string;
    suggestedRoomId: string;
    reason: string;
  }[]> {
    try {
      const [unassignedTenants, availableRooms] = await Promise.all([
        this.getUnassignedTenants(),
        this.getAvailableRooms()
      ]);

      const suggestions = [];

      // Simple assignment strategy: assign tenants to available rooms
      const maxAssignments = Math.min(unassignedTenants.length, availableRooms.length);
      
      for (let i = 0; i < maxAssignments; i++) {
        suggestions.push({
          tenantId: unassignedTenants[i].id,
          suggestedRoomId: availableRooms[i].id,
          reason: `Available room ${availableRooms[i].number} suitable for ${unassignedTenants[i].firstName} ${unassignedTenants[i].lastName}`
        });
      }

      return suggestions;
    } catch (error) {
      console.error('Error generating room assignment suggestions:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const tenantAssignmentService = new TenantAssignmentService();