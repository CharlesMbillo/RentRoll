essimport React from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export default function SimpleLogin({ onLogin }: { onLogin?: () => void }) {
  const email = "test@example.com";
  const password = "password123";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For development/demo purposes
    console.log("Logging in with", { email, password });
    
    // Redirect to role selection or trigger login
    if (onLogin) {
      onLogin();
    } else {
      // Scroll to role selection on landing page
      const roleSection = document.getElementById('role-selection');
      if (roleSection) {
        roleSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sign In to RentFlow</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Test credentials display */}
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-sm text-gray-800 mb-2">
              Demo Credentials
            </h3>
            <p className="text-sm text-gray-700">
              <strong>Email:</strong> test@example.com
            </p>
            <p className="text-sm text-gray-700">
              <strong>Password:</strong> password123
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              readOnly
              className="bg-gray-50 cursor-not-allowed"
              data-testid="input-email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              readOnly
              className="bg-gray-50 cursor-not-allowed"
              data-testid="input-password"
            />
            <Button
              type="submit"
              className="w-full"
              data-testid="button-simple-login"
            >
              Continue to Role Selection
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Click continue to choose your role (Landlord, Caretaker, or Tenant)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}