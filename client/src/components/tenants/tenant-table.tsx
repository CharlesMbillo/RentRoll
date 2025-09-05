import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TenantForm from "./tenant-form";
import { Edit, Eye, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@/lib/types";

interface TenantTableProps {
  tenants: Tenant[];
}

export default function TenantTable({ tenants }: TenantTableProps) {
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      await apiRequest("DELETE", `/api/tenants/${tenantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({
        title: "Success",
        description: "Tenant deleted successfully",
      });
      setDeletingTenant(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete tenant",
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const variant = status === "active" ? "default" : "secondary";
    return (
      <Badge variant={variant} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (tenants.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No tenants found.</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-foreground">Tenant</th>
                <th className="text-left py-3 px-6 font-medium text-foreground">Phone</th>
                <th className="text-left py-3 px-6 font-medium text-foreground">Room</th>
                <th className="text-left py-3 px-6 font-medium text-foreground">Status</th>
                <th className="text-left py-3 px-6 font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-muted/50" data-testid={`tenant-row-${tenant.id}`}>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(tenant.firstName, tenant.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground" data-testid={`text-tenant-name-${tenant.id}`}>
                          {tenant.firstName} {tenant.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-tenant-email-${tenant.id}`}>
                          {tenant.email || "No email"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-foreground" data-testid={`text-tenant-phone-${tenant.id}`}>
                    {tenant.phone}
                  </td>
                  <td className="py-4 px-6 text-foreground" data-testid={`text-tenant-room-${tenant.id}`}>
                    {tenant.roomId ? "Assigned" : "No room"}
                  </td>
                  <td className="py-4 px-6" data-testid={`badge-tenant-status-${tenant.id}`}>
                    {getStatusBadge(tenant.status)}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setEditingTenant(tenant)}
                        data-testid={`button-edit-tenant-${tenant.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        data-testid={`button-view-tenant-${tenant.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setDeletingTenant(tenant)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-tenant-${tenant.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTenant} onOpenChange={() => setEditingTenant(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          {editingTenant && (
            <TenantForm 
              tenant={editingTenant}
              onClose={() => setEditingTenant(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTenant} onOpenChange={() => setDeletingTenant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingTenant?.firstName} {deletingTenant?.lastName}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTenant && deleteMutation.mutate(deletingTenant.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-tenant"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
