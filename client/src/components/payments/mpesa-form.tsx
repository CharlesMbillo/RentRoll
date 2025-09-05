import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@/lib/types";

const mpesaSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  amount: z.string().min(1, "Amount is required"),
  tenantId: z.string().min(1, "Tenant is required"),
  roomId: z.string().optional(),
});

type MpesaFormData = z.infer<typeof mpesaSchema>;

interface MpesaFormProps {
  onClose: () => void;
}

export default function MpesaForm({ onClose }: MpesaFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
    retry: false,
  });

  const form = useForm<MpesaFormData>({
    resolver: zodResolver(mpesaSchema),
    defaultValues: {
      phoneNumber: "",
      amount: "",
      tenantId: "",
      roomId: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: MpesaFormData) => {
      const response = await apiRequest("POST", "/api/mpesa/stk-push", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "STK Push Sent",
        description: "Payment request sent to the customer's phone",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send STK Push",
        variant: "destructive",
      });
    },
  });

  const selectedTenant = form.watch("tenantId");
  const tenant = tenants.find(t => t.id === selectedTenant);

  // Auto-fill phone number when tenant is selected
  React.useEffect(() => {
    if (tenant) {
      form.setValue("phoneNumber", tenant.phone);
      form.setValue("roomId", tenant.roomId || "");
    }
  }, [tenant, form]);

  const onSubmit = (data: MpesaFormData) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-mpesa">
        <FormField
          control={form.control}
          name="tenantId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Tenant</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-tenant">
                    <SelectValue placeholder="Choose tenant" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.firstName} {tenant.lastName} - {tenant.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="+254 712 345 678" {...field} data-testid="input-phone-number" />
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
                <Input type="number" placeholder="12000" {...field} data-testid="input-amount" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={mutation.isPending}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-send-stk"
          >
            {mutation.isPending ? "Sending..." : "Send STK Push"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
