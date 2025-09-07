import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import type { Tenant } from "../../lib/types";
import { CreditCard, Smartphone } from "lucide-react";

const quickMpesaSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  amount: z.string().min(1, "Amount is required"),
  tenantId: z.string().min(1, "Tenant is required"),
  roomId: z.string().min(1, "Room is required"),
});

type QuickMpesaFormData = z.infer<typeof quickMpesaSchema>;

interface QuickMpesaFormProps {
  roomId?: string;
  tenantId?: string;
  amount?: string;
  onClose: () => void;
}

export default function QuickMpesaForm({ roomId, tenantId, amount, onClose }: QuickMpesaFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
    retry: false,
  });

  const form = useForm<QuickMpesaFormData>({
    resolver: zodResolver(quickMpesaSchema),
    defaultValues: {
      phoneNumber: "",
      amount: amount || "",
      tenantId: tenantId || "",
      roomId: roomId || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: QuickMpesaFormData) => {
      const response = await apiRequest("POST", "/api/mpesa/stk-push", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "STK Push Sent!",
        description: "Payment request sent to tenant's phone. Check your phone to complete payment.",
        duration: 5000,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Payment Failed",
        description: "Failed to send payment request. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Pre-fill tenant data when provided
  useEffect(() => {
    if (tenantId) {
      const tenant = tenants.find(t => t.id === tenantId);
      if (tenant) {
        form.setValue("phoneNumber", tenant.phone);
        form.setValue("tenantId", tenant.id);
        form.setValue("roomId", tenant.roomId || roomId || "");
      }
    }
  }, [tenantId, tenants, roomId, form]);

  const onSubmit = (data: QuickMpesaFormData) => {
    mutation.mutate(data);
  };

  const selectedTenant = tenants.find(t => t.id === form.watch("tenantId"));

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
          <Smartphone className="w-4 h-4" />
          M-Pesa Payment
        </div>
        {selectedTenant && (
          <div className="mt-2 text-sm text-green-600 dark:text-green-400">
            <div>Tenant: {selectedTenant.firstName} {selectedTenant.lastName}</div>
            <div>Phone: {selectedTenant.phone}</div>
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-quick-mpesa">
          
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="+254 712 345 678" 
                    {...field} 
                    data-testid="input-phone-number"
                    className="text-lg"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (KSh)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="15000" 
                    {...field} 
                    data-testid="input-amount"
                    className="text-lg font-semibold"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={mutation.isPending}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 text-lg"
              data-testid="button-pay-now"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              {mutation.isPending ? "SENDING..." : "PAY NOW"}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              data-testid="button-cancel"
              className="mt-2"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>

      <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
        <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">How it works:</div>
        <div>1. Click "PAY NOW" to send payment request</div>
        <div>2. Check your phone for M-Pesa payment prompt</div>
        <div>3. Enter your M-Pesa PIN to complete payment</div>
      </div>
    </div>
  );
}