import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, Wifi, WifiOff } from "lucide-react";

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'not_configured' | 'error';
  configured: boolean;
  timestamp?: string;
  message?: string;
}

interface BalanceData {
  accountNumber: string;
  currency: string;
  balances: {
    available: string;
    actual: string;
  };
  message?: string;
}

export default function JengaStatus() {
  const { data: healthStatus, isLoading, refetch } = useQuery<HealthStatus>({
    queryKey: ['/api/jenga/health'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: balance } = useQuery<BalanceData>({
    queryKey: ['/api/jenga/balance'],
    enabled: healthStatus?.configured === true,
  });

  const getStatusIcon = () => {
    if (isLoading) return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    if (!healthStatus?.configured) return <WifiOff className="w-4 h-4 text-gray-500" />;
    if (healthStatus.status === 'healthy') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (healthStatus.status === 'unhealthy') return <XCircle className="w-4 h-4 text-red-500" />;
    return <Wifi className="w-4 h-4 text-blue-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return "Checking...";
    if (!healthStatus?.configured) return "Not Configured";
    if (healthStatus.status === 'healthy') return "Connected";
    if (healthStatus.status === 'unhealthy') return "Connection Error";
    return "Unknown";
  };

  const getStatusColor = (): "default" | "secondary" | "destructive" | "outline" => {
    if (isLoading) return "outline";
    if (!healthStatus?.configured) return "secondary";
    if (healthStatus.status === 'healthy') return "default";
    if (healthStatus.status === 'unhealthy') return "destructive";
    return "outline";
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            JengaAPI Status
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusColor()}>
              {getStatusText()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8 px-2"
            >
              Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {healthStatus?.configured ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Environment:</span>
              <span className="font-medium">
                {process.env.NODE_ENV === 'production' ? 'Production' : 'Sandbox'}
              </span>
            </div>
            
            {balance && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Account Balance:</span>
                <span className="font-medium">
                  {balance.currency} {balance.balances?.available || '0.00'}
                </span>
              </div>
            )}
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Check:</span>
              <span className="font-medium">
                {healthStatus.timestamp ? new Date(healthStatus.timestamp).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center p-4 text-muted-foreground">
            <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">JengaAPI not configured</p>
            <p className="text-xs mt-1">
              Add JENGA_API_KEY, JENGA_MERCHANT_CODE, and JENGA_CONSUMER_SECRET to environment variables
            </p>
          </div>
        )}

        {healthStatus?.status === 'unhealthy' && (
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
              <XCircle className="w-4 h-4" />
              Connection to JengaAPI failed
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Check your API credentials and network connection
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}