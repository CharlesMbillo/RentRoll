import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import type { Payment } from "@/lib/types";

interface TransactionTableProps {
  payments: Payment[];
}

export default function TransactionTable({ payments }: TransactionTableProps) {
  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      refunded: "outline",
    } as const;

    const variant = variants[status as keyof typeof variants] || "secondary";

    return (
      <Badge variant={variant} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getMethodBadge = (method: string) => {
    const colors = {
      mpesa: "bg-green-100 text-green-800",
      bank_transfer: "bg-blue-100 text-blue-800",
      cash: "bg-yellow-100 text-yellow-800",
      check: "bg-purple-100 text-purple-800",
    } as const;

    const colorClass = colors[method as keyof typeof colors] || "bg-gray-100 text-gray-800";

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${colorClass}`}>
        {method.replace('_', ' ')}
      </span>
    );
  };

  const formatCurrency = (amount: string) => {
    return `KSh ${parseFloat(amount).toLocaleString()}`;
  };

  if (payments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No transactions found.</p>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="text-left py-3 px-6 font-medium text-foreground">Date</th>
            <th className="text-left py-3 px-6 font-medium text-foreground">Amount</th>
            <th className="text-left py-3 px-6 font-medium text-foreground">Method</th>
            <th className="text-left py-3 px-6 font-medium text-foreground">Status</th>
            <th className="text-left py-3 px-6 font-medium text-foreground">Due Date</th>
            <th className="text-left py-3 px-6 font-medium text-foreground">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {payments.map((payment) => (
            <tr key={payment.id} className="hover:bg-muted/50" data-testid={`payment-row-${payment.id}`}>
              <td className="py-4 px-6 text-foreground" data-testid={`text-payment-date-${payment.id}`}>
                {payment.createdAt ? format(new Date(payment.createdAt), "MMM dd, yyyy") : "-"}
              </td>
              <td className="py-4 px-6 text-foreground font-medium" data-testid={`text-payment-amount-${payment.id}`}>
                {formatCurrency(payment.amount)}
              </td>
              <td className="py-4 px-6" data-testid={`badge-payment-method-${payment.id}`}>
                {getMethodBadge(payment.paymentMethod)}
              </td>
              <td className="py-4 px-6" data-testid={`badge-payment-status-${payment.id}`}>
                {getStatusBadge(payment.paymentStatus)}
              </td>
              <td className="py-4 px-6 text-foreground" data-testid={`text-payment-due-${payment.id}`}>
                {format(new Date(payment.dueDate), "MMM dd, yyyy")}
              </td>
              <td className="py-4 px-6 text-foreground text-sm" data-testid={`text-payment-notes-${payment.id}`}>
                {payment.notes || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
