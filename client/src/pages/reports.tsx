import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Download, TrendingUp, Calendar } from "lucide-react";
import type { DashboardMetrics } from "@/lib/types";

export default function Reports() {
  const [reportType, setReportType] = useState("revenue");
  const [dateRange, setDateRange] = useState("thisMonth");

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    retry: false,
  });

  const formatCurrency = (amount: number) => {
    return `KSh ${amount.toLocaleString()}`;
  };

  const generateReport = () => {
    // TODO: Implement report generation logic
    console.log(`Generating ${reportType} report for ${dateRange}`);
  };

  const exportReport = () => {
    // TODO: Implement report export logic
    console.log(`Exporting ${reportType} report as PDF`);
  };

  return (
    <div className="space-y-6" data-testid="page-reports">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-page-title">
          Reports & Analytics
        </h2>
        <p className="text-muted-foreground">
          Financial reports, occupancy analytics, and performance metrics.
        </p>
      </div>

      {/* Report Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-48" data-testid="select-report-type">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue Report</SelectItem>
                  <SelectItem value="occupancy">Occupancy Report</SelectItem>
                  <SelectItem value="payment">Payment Status Report</SelectItem>
                  <SelectItem value="tenant">Tenant Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-48" data-testid="select-date-range">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="last3Months">Last 3 Months</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                  <SelectItem value="lastYear">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end space-x-2">
              <Button onClick={generateReport} data-testid="button-generate-report">
                <BarChart3 className="w-4 h-4 mr-2" />
                Generate
              </Button>
              <Button variant="outline" onClick={exportReport} data-testid="button-export-report">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Monthly Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-container bg-muted/20 rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Monthly Revenue Chart</p>
                <p className="text-sm">Chart implementation with Chart.js needed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Payment Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-container bg-muted/20 rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Payment Status Chart</p>
                <p className="text-sm">Pie chart implementation needed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center animate-pulse">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded mb-1"></div>
                  <div className="h-3 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-total-revenue">
                  {metrics ? formatCurrency(metrics.monthlyRevenue) : "KSh 0"}
                </div>
                <div className="text-sm text-muted-foreground">Total Revenue</div>
                <div className="text-xs text-green-600 mt-1">+8.2% from last month</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-collection-rate">
                  {metrics ? `${metrics.occupancyRate.toFixed(1)}%` : "0%"}
                </div>
                <div className="text-sm text-muted-foreground">Collection Rate</div>
                <div className="text-xs text-green-600 mt-1">+2.5% from last month</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-avg-delay">
                  3.2 days
                </div>
                <div className="text-sm text-muted-foreground">Avg. Payment Delay</div>
                <div className="text-xs text-yellow-600 mt-1">-0.8 days improvement</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground mb-1" data-testid="text-vacancy-rate">
                  {metrics ? `${(100 - metrics.occupancyRate).toFixed(1)}%` : "0%"}
                </div>
                <div className="text-sm text-muted-foreground">Vacancy Rate</div>
                <div className="text-xs text-yellow-600 mt-1">
                  {metrics ? `${metrics.totalUnits - metrics.occupiedUnits} vacant units` : "0 vacant units"}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Recent Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <div className="font-medium text-foreground">Monthly Revenue Report - December 2024</div>
                <div className="text-sm text-muted-foreground">Generated on Dec 15, 2024</div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" data-testid="button-view-report">
                  View
                </Button>
                <Button variant="outline" size="sm" data-testid="button-download-report">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <div className="font-medium text-foreground">Occupancy Analysis - November 2024</div>
                <div className="text-sm text-muted-foreground">Generated on Nov 30, 2024</div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" data-testid="button-view-report">
                  View
                </Button>
                <Button variant="outline" size="sm" data-testid="button-download-report">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <div className="font-medium text-foreground">Payment Status Summary - November 2024</div>
                <div className="text-sm text-muted-foreground">Generated on Nov 25, 2024</div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" data-testid="button-view-report">
                  View
                </Button>
                <Button variant="outline" size="sm" data-testid="button-download-report">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
