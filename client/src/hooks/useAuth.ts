import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  // Extract role parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  
  // Build query key with role parameter if present
  const queryKey = roleParam 
    ? [`/api/auth/user?role=${roleParam}`]
    : ["/api/auth/user"];

  const { data: user, isLoading } = useQuery({
    queryKey,
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
