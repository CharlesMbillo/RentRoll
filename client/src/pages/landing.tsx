import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, CreditCard, MessageSquare, BarChart3 } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-6">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">RentFlow</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Complete property management platform with automated rent collection, 
            tenant management, and real-time analytics.
          </p>
          <Button 
            onClick={handleLogin}
            size="lg"
            className="px-8 py-3 text-lg"
            data-testid="button-login"
          >
            Sign In to Continue
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Room Management</h3>
              <p className="text-sm text-muted-foreground">
                Visual 74-unit matrix with real-time status tracking
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">M-Pesa Integration</h3>
              <p className="text-sm text-muted-foreground">
                Seamless mobile payments with STK Push technology
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">SMS Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Automated reminders and payment confirmations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Revenue tracking and occupancy reports
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Key Benefits */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            Why Property Managers Choose RentFlow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-foreground">Automated Rent Collection</h4>
                  <p className="text-sm text-muted-foreground">
                    Reduce manual work with automated payment reminders and M-Pesa integration
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-foreground">Real-time Monitoring</h4>
                  <p className="text-sm text-muted-foreground">
                    Track payment status across all 74 units with color-coded visualization
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-foreground">Role-based Access</h4>
                  <p className="text-sm text-muted-foreground">
                    Secure access control for landlords, caretakers, and tenants
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-foreground">Comprehensive Reporting</h4>
                  <p className="text-sm text-muted-foreground">
                    Generate detailed revenue and occupancy reports for informed decisions
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-foreground">SMS Automation</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatic payment reminders and overdue escalation system
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-foreground">Mobile Optimized</h4>
                  <p className="text-sm text-muted-foreground">
                    Fully responsive design for management on any device
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Ready to Streamline Your Property Management?
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Join property managers who trust RentFlow for efficient rent collection and tenant management.
              </p>
              <Button 
                onClick={handleLogin}
                className="w-full"
                data-testid="button-login-cta"
              >
                Get Started Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
