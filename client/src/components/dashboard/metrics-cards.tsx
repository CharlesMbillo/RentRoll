import { TrendingUp, Home, Clock, AlertTriangle } from "lucide-react";
import type { DashboardMetrics } from "@/lib/types";

interface MetricsCardsProps {
  metrics: DashboardMetrics;
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const formatCurrency = (amount: number) => {
    return `KSh ${(amount / 1000).toFixed(0)}K`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-card rounded-xl p-6 border border-border" data-testid="card-occupancy">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <Home className="w-6 h-6 text-green-600" />
          </div>
          <span className="text-sm text-green-600 font-medium">+2.5%</span>
        </div>
        <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-occupancy-rate">
          {metrics.occupancyRate.toFixed(1)}%
        </div>
        <div className="text-sm text-muted-foreground">Occupancy Rate</div>
        <div className="text-xs text-muted-foreground mt-2" data-testid="text-occupied-units">
          {metrics.occupiedUnits} of {metrics.totalUnits} units occupied
        </div>
      </div>

      <div className="bg-card rounded-xl p-6 border border-border" data-testid="card-revenue">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <span className="text-sm text-blue-600 font-medium">+8.2%</span>
        </div>
        <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-monthly-revenue">
          {formatCurrency(metrics.monthlyRevenue)}
        </div>
        <div className="text-sm text-muted-foreground">Monthly Revenue</div>
        <div className="text-xs text-muted-foreground mt-2">Target: KSh 925K</div>
      </div>

      <div className="bg-card rounded-xl p-6 border border-border" data-testid="card-pending">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <span className="text-sm text-yellow-600 font-medium">-5</span>
        </div>
        <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-pending-payments">
          {metrics.pendingPayments}
        </div>
        <div className="text-sm text-muted-foreground">Pending Payments</div>
        <div className="text-xs text-muted-foreground mt-2">Due in 3 days</div>
      </div>

      <div className="bg-card rounded-xl p-6 border border-border" data-testid="card-overdue">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <span className="text-sm text-red-600 font-medium">+2</span>
        </div>
        <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-overdue-payments">
          {metrics.overduePayments}
        </div>
        <div className="text-sm text-muted-foreground">Overdue Payments</div>
        <div className="text-xs text-muted-foreground mt-2">Requires action</div>
      </div>
    </div>
  );
}
