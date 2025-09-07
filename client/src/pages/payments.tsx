import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import MpesaForm from "../components/payments/mpesa-form";
import TransactionTable from "../components/payments/transaction-table";
import { Plus, CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { Payment } from "../lib/types";

export default function Payments() {
  const [isMpesaDialogOpen, setIsMpesaDialogOpen] = useState(false);

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    retry: false,
  });

  // Calculate payment statistics
  const completedPayments = payments.filter(p => p.paymentStatus === "completed");
  const pendingPayments = payments.filter(p => p.paymentStatus === "pending");
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyPayments = completedPayments.filter(p => p.month === currentMonth);
  
  const collectedAmount = monthlyPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const overduePayments = pendingPayments.filter(p => new Date(p.dueDate) < new Date());
  const overdueAmount = overduePayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const formatCurrency = (amount: number) => {
    return `KSh ${(amount / 1000).toFixed(0)}K`;
  };

  return (
    <div className="space-y-6" data-testid="page-payments">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-page-title">
            Payment Management
          </h2>
          <p className="text-muted-foreground">
            M-Pesa integration, payment tracking, and transaction history.
          </p>
        </div>
        <Button data-testid="button-record-payment">
          <Plus className="w-4 h-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-collected-amount">
              {formatCurrency(collectedAmount)}
            </div>
            <div className="text-sm text-muted-foreground">Collected This Month</div>
            <div className="text-xs text-green-600 mt-2" data-testid="text-collected-count">
              {completedPayments.length} payments received
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-pending-amount">
              {formatCurrency(pendingAmount)}
            </div>
            <div className="text-sm text-muted-foreground">Pending Collection</div>
            <div className="text-xs text-yellow-600 mt-2" data-testid="text-pending-count">
              {pendingPayments.length} payments due
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-overdue-amount">
              {formatCurrency(overdueAmount)}
            </div>
            <div className="text-sm text-muted-foreground">Overdue Amount</div>
            <div className="text-xs text-red-600 mt-2" data-testid="text-overdue-count">
              {overduePayments.length} overdue payments
            </div>
          </CardContent>
        </Card>
      </div>

      {/* M-Pesa Integration Panel */}
      <Card>
        <CardHeader>
          <CardTitle>M-Pesa STK Push</CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={isMpesaDialogOpen} onOpenChange={setIsMpesaDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700" data-testid="button-mpesa-stk">
                <span className="mr-2">📱</span>
                Send STK Push
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>M-Pesa STK Push Payment</DialogTitle>
              </DialogHeader>
              <MpesaForm onClose={() => setIsMpesaDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : (
            <TransactionTable payments={payments} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
