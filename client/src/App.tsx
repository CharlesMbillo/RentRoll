import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { useAuth } from "./hooks/useAuth";
import Landing from "./pages/landing";
import Dashboard from "./pages/dashboard";
import RoomMatrix from "./pages/room-matrix";
import Tenants from "./pages/tenants";
import Payments from "./pages/payments";
import Reports from "./pages/reports";
import Notifications from "./pages/notifications";
import Settings from "./pages/settings";
import NotFound from "./pages/not-found";
import Navbar from "./components/layout/navbar";
import Sidebar from "./components/layout/sidebar";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={AuthenticatedApp} />
          <Route path="/dashboard" component={AuthenticatedApp} />
          <Route path="/rooms" component={AuthenticatedApp} />
          <Route path="/tenants" component={AuthenticatedApp} />
          <Route path="/payments" component={AuthenticatedApp} />
          <Route path="/reports" component={AuthenticatedApp} />
          <Route path="/notifications" component={AuthenticatedApp} />
          <Route path="/settings" component={AuthenticatedApp} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/rooms" component={RoomMatrix} />
            <Route path="/tenants" component={Tenants} />
            <Route path="/payments" component={Payments} />
            <Route path="/reports" component={Reports} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
