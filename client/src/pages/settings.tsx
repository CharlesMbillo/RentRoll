import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Save, Settings2, CreditCard, MessageSquare, Shield, Building } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import type { SystemSetting } from "../lib/types";

const mpesaSettingsSchema = z.object({
  businessShortCode: z.string().min(1, "Business short code is required"),
  passkey: z.string().min(1, "Passkey is required"),
  enableMpesa: z.boolean(),
});

const smsSettingsSchema = z.object({
  smsProvider: z.string().min(1, "SMS provider is required"),
  senderId: z.string().min(1, "Sender ID is required"),
  enableSms: z.boolean(),
});

const propertySettingsSchema = z.object({
  propertyName: z.string().min(1, "Property name is required"),
  totalUnits: z.string().min(1, "Total units is required"),
  currency: z.string().min(1, "Currency is required"),
});

type MpesaSettings = z.infer<typeof mpesaSettingsSchema>;
type SmsSettings = z.infer<typeof smsSettingsSchema>;
type PropertySettings = z.infer<typeof propertySettingsSchema>;

export default function Settings() {
  const [enableTwoFactor, setEnableTwoFactor] = useState(false);
  const [enableAuditLogging, setEnableAuditLogging] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings = [] } = useQuery<SystemSetting[]>({
    queryKey: ["/api/settings"],
    retry: false,
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description?: string }) => {
      const response = await apiRequest("PUT", `/api/settings/${key}`, { value, description });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Settings have been saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const mpesaForm = useForm<MpesaSettings>({
    resolver: zodResolver(mpesaSettingsSchema),
    defaultValues: {
      businessShortCode: "174379",
      passkey: "",
      enableMpesa: true,
    },
  });

  const smsForm = useForm<SmsSettings>({
    resolver: zodResolver(smsSettingsSchema),
    defaultValues: {
      smsProvider: "africas-talking",
      senderId: "RENTFLOW",
      enableSms: true,
    },
  });

  const propertyForm = useForm<PropertySettings>({
    resolver: zodResolver(propertySettingsSchema),
    defaultValues: {
      propertyName: "State House Block D",
      totalUnits: "74",
      currency: "KSh",
    },
  });

  const onMpesaSubmit = (data: MpesaSettings) => {
    updateSettingMutation.mutate({
      key: "mpesa_settings",
      value: JSON.stringify(data),
      description: "M-Pesa integration settings",
    });
  };

  const onSmsSubmit = (data: SmsSettings) => {
    updateSettingMutation.mutate({
      key: "sms_settings",
      value: JSON.stringify(data),
      description: "SMS notification settings",
    });
  };

  const onPropertySubmit = (data: PropertySettings) => {
    updateSettingMutation.mutate({
      key: "property_settings",
      value: JSON.stringify(data),
      description: "Property configuration settings",
    });
  };

  const handleSecuritySettingChange = (key: string, value: boolean) => {
    updateSettingMutation.mutate({
      key,
      value: value.toString(),
      description: `Security setting: ${key}`,
    });

    if (key === "two_factor_auth") {
      setEnableTwoFactor(value);
    } else if (key === "audit_logging") {
      setEnableAuditLogging(value);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-settings">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-page-title">
          System Settings
        </h2>
        <p className="text-muted-foreground">
          Configure system preferences, integrations, and security settings.
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* M-Pesa Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              M-Pesa Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...mpesaForm}>
              <form onSubmit={mpesaForm.handleSubmit(onMpesaSubmit)} className="space-y-4" data-testid="form-mpesa-settings">
                <FormField
                  control={mpesaForm.control}
                  name="businessShortCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Short Code</FormLabel>
                      <FormControl>
                        <Input placeholder="174379" {...field} data-testid="input-business-short-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={mpesaForm.control}
                  name="passkey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passkey</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••••••••••" {...field} data-testid="input-passkey" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={mpesaForm.control}
                  name="enableMpesa"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div>
                        <FormLabel className="text-sm font-medium">Enable M-Pesa Payments</FormLabel>
                      </div>
                      <FormControl>
                        <Switch 
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enable-mpesa"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateSettingMutation.isPending} data-testid="button-save-mpesa">
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingMutation.isPending ? "Saving..." : "Save M-Pesa Settings"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* SMS Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              SMS Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...smsForm}>
              <form onSubmit={smsForm.handleSubmit(onSmsSubmit)} className="space-y-4" data-testid="form-sms-settings">
                <FormField
                  control={smsForm.control}
                  name="smsProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMS Provider</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-sms-provider">
                            <SelectValue placeholder="Select SMS provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="africas-talking">Africa's Talking</SelectItem>
                          <SelectItem value="twilio">Twilio</SelectItem>
                          <SelectItem value="sms-gateway">SMS Gateway</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={smsForm.control}
                  name="senderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sender ID</FormLabel>
                      <FormControl>
                        <Input placeholder="RENTFLOW" {...field} data-testid="input-sender-id" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={smsForm.control}
                  name="enableSms"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div>
                        <FormLabel className="text-sm font-medium">Enable SMS Notifications</FormLabel>
                      </div>
                      <FormControl>
                        <Switch 
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enable-sms"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateSettingMutation.isPending} data-testid="button-save-sms">
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingMutation.isPending ? "Saving..." : "Save SMS Settings"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="font-medium text-foreground">Two-Factor Authentication</div>
                  <div className="text-sm text-muted-foreground">Extra security for admin accounts</div>
                </div>
                <Switch 
                  checked={enableTwoFactor}
                  onCheckedChange={(checked) => handleSecuritySettingChange("two_factor_auth", checked)}
                  data-testid="switch-two-factor"
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="font-medium text-foreground">Audit Logging</div>
                  <div className="text-sm text-muted-foreground">Track all financial transactions</div>
                </div>
                <Switch 
                  checked={enableAuditLogging}
                  onCheckedChange={(checked) => handleSecuritySettingChange("audit_logging", checked)}
                  data-testid="switch-audit-logging"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="w-5 h-5 mr-2" />
              Property Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...propertyForm}>
              <form onSubmit={propertyForm.handleSubmit(onPropertySubmit)} className="space-y-4" data-testid="form-property-settings">
                <FormField
                  control={propertyForm.control}
                  name="propertyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-property-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={propertyForm.control}
                  name="totalUnits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Units</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-total-units" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={propertyForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="KSh">KSh (Kenyan Shilling)</SelectItem>
                          <SelectItem value="USD">USD (US Dollar)</SelectItem>
                          <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateSettingMutation.isPending} data-testid="button-save-property">
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingMutation.isPending ? "Saving..." : "Save Property Settings"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings2 className="w-5 h-5 mr-2" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-lg font-semibold text-foreground">v1.0.0</div>
              <div className="text-sm text-muted-foreground">Application Version</div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-lg font-semibold text-foreground">Dec 2024</div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-lg font-semibold text-foreground">Active</div>
              <div className="text-sm text-muted-foreground">System Status</div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-lg font-semibold text-foreground">PostgreSQL</div>
              <div className="text-sm text-muted-foreground">Database</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
