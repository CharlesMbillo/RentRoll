import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import type { SmsNotification, Tenant } from "../lib/types";

export default function Notifications() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [messageType, setMessageType] = useState("payment_reminder");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<SmsNotification[]>({
    queryKey: ["/api/sms-notifications"],
    retry: false,
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
    retry: false,
  });

  const sendCustomSMSMutation = useMutation({
    mutationFn: async (data: { tenantId: string; phoneNumber: string; message: string; messageType: string }) => {
      const response = await apiRequest("POST", "/api/sms-notifications", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-notifications"] });
      toast({
        title: "SMS Sent",
        description: "Custom SMS notification sent successfully",
      });
      setIsDialogOpen(false);
      setCustomMessage("");
      setSelectedTenant("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send SMS notification",
        variant: "destructive",
      });
    },
  });

  const handleSendCustomSMS = () => {
    const tenant = tenants.find(t => t.id === selectedTenant);
    if (!tenant || !customMessage.trim()) {
      toast({
        title: "Error",
        description: "Please select a tenant and enter a message",
        variant: "destructive",
      });
      return;
    }

    sendCustomSMSMutation.mutate({
      tenantId: tenant.id,
      phoneNumber: tenant.phone,
      message: customMessage,
      messageType,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, icon: Clock },
      sent: { variant: "default" as const, icon: CheckCircle },
      failed: { variant: "destructive" as const, icon: AlertCircle },
    };

    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="w-3 h-3" />
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const getMessageTypeBadge = (type: string) => {
    const colors = {
      payment_reminder: "bg-blue-100 text-blue-800",
      overdue_notice: "bg-red-100 text-red-800",
      payment_confirmation: "bg-green-100 text-green-800",
      monthly_statement: "bg-purple-100 text-purple-800",
    } as const;

    const colorClass = colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${colorClass}`}>
        {type.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="page-notifications">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-page-title">
            SMS Notifications
          </h2>
          <p className="text-muted-foreground">
            Automated payment reminders and escalation system.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-send-custom-sms">
              <Plus className="w-4 h-4 mr-2" />
              Send Custom SMS
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Custom SMS</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Select Tenant</label>
                <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                  <SelectTrigger data-testid="select-tenant-sms">
                    <SelectValue placeholder="Choose tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.firstName} {tenant.lastName} - {tenant.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Message Type</label>
                <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger data-testid="select-message-type">
                    <SelectValue placeholder="Select message type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                    <SelectItem value="overdue_notice">Overdue Notice</SelectItem>
                    <SelectItem value="payment_confirmation">Payment Confirmation</SelectItem>
                    <SelectItem value="monthly_statement">Monthly Statement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Message</label>
                <Textarea
                  placeholder="Enter your custom message..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  data-testid="textarea-custom-message"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {customMessage.length}/160 characters
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-sms">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendCustomSMS}
                  disabled={sendCustomSMSMutation.isPending}
                  data-testid="button-send-sms"
                >
                  {sendCustomSMSMutation.isPending ? "Sending..." : "Send SMS"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="font-medium text-foreground">Payment Reminders</div>
                  <div className="text-sm text-muted-foreground">3 days before due date</div>
                </div>
                <Switch defaultChecked data-testid="switch-payment-reminders" />
              </div>
              
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="font-medium text-foreground">Overdue Escalation</div>
                  <div className="text-sm text-muted-foreground">7 days after due date</div>
                </div>
                <Switch defaultChecked data-testid="switch-overdue-escalation" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="font-medium text-foreground">Payment Confirmations</div>
                  <div className="text-sm text-muted-foreground">After successful payment</div>
                </div>
                <Switch defaultChecked data-testid="switch-payment-confirmations" />
              </div>
              
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="font-medium text-foreground">Monthly Statements</div>
                  <div className="text-sm text-muted-foreground">End of each month</div>
                </div>
                <Switch data-testid="switch-monthly-statements" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Message Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground">Payment Reminder</span>
                <Button variant="ghost" size="sm" data-testid="button-edit-template-reminder">
                  Edit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Hi {'{tenant_name}'}, your rent for room {'{room_number}'} is due in 3 days. 
                Amount: KSh {'{amount}'}. Pay via M-Pesa to 123456.
              </p>
            </div>
            
            <div className="p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground">Overdue Notice</span>
                <Button variant="ghost" size="sm" data-testid="button-edit-template-overdue">
                  Edit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                URGENT: Your rent for room {'{room_number}'} is 7 days overdue. 
                Please pay KSh {'{amount}'} immediately to avoid further action.
              </p>
            </div>

            <div className="p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground">Payment Confirmation</span>
                <Button variant="ghost" size="sm" data-testid="button-edit-template-confirmation">
                  Edit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Thank you {'{tenant_name}'}! We have received your payment of KSh {'{amount}'} 
                for room {'{room_number}'}. Receipt: {'{receipt_number}'}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Recent SMS History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notificationsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                  <div className="h-4 bg-muted rounded flex-1"></div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No SMS notifications sent yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-3 px-6 font-medium text-foreground">Date</th>
                    <th className="text-left py-3 px-6 font-medium text-foreground">Recipient</th>
                    <th className="text-left py-3 px-6 font-medium text-foreground">Type</th>
                    <th className="text-left py-3 px-6 font-medium text-foreground">Status</th>
                    <th className="text-left py-3 px-6 font-medium text-foreground">Message Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <tr key={notification.id} className="hover:bg-muted/50" data-testid={`notification-row-${notification.id}`}>
                      <td className="py-4 px-6 text-foreground" data-testid={`text-notification-date-${notification.id}`}>
                        {notification.createdAt ? new Date(notification.createdAt).toLocaleDateString() : "-"} {notification.createdAt ? new Date(notification.createdAt).toLocaleTimeString() : ""}
                      </td>
                      <td className="py-4 px-6 text-foreground" data-testid={`text-notification-phone-${notification.id}`}>
                        {notification.phoneNumber}
                      </td>
                      <td className="py-4 px-6" data-testid={`badge-notification-type-${notification.id}`}>
                        {getMessageTypeBadge(notification.messageType)}
                      </td>
                      <td className="py-4 px-6" data-testid={`badge-notification-status-${notification.id}`}>
                        {getStatusBadge(notification.status)}
                      </td>
                      <td className="py-4 px-6 text-foreground text-sm max-w-xs truncate" data-testid={`text-notification-message-${notification.id}`}>
                        {notification.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
