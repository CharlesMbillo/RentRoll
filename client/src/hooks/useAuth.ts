import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Quick timeout for demo mode
    staleTime: 0,
    gcTime: 0,
  });

  // For frontend-only demo: provide mock user when API fails
  const mockUser = {
    id: "demo-user",
    email: "demo@rentflow.com",
    firstName: "Demo",
    lastName: "User",
    role: "landlord",
    profileImageUrl: null,
  };

  // If API call fails (no backend), use mock user for demo
  const finalUser = user || (error ? mockUser : null);

  return {
    user: finalUser,
    isLoading,
    isAuthenticated: !!finalUser,
  };
}
