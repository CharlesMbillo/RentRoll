import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem('rentflow_session_id');
  } catch {
    return null;
  }
}

function setStoredSessionId(sessionId: string | null): void {
  try {
    if (sessionId) {
      localStorage.setItem('rentflow_session_id', sessionId);
    } else {
      localStorage.removeItem('rentflow_session_id');
    }
  } catch {
    // Handle storage errors silently
  }
}

export function useAuth() {
  // Extract role parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  const storedSessionId = getStoredSessionId();
  
  // Build query key with role parameter or stored session ID
  let queryKey: string[];
  if (roleParam) {
    queryKey = [`/api/auth/user?role=${roleParam}`];
  } else if (storedSessionId) {
    queryKey = [`/api/auth/user?sessionId=${storedSessionId}`];
  } else {
    queryKey = ["/api/auth/user"];
  }

  const { data: user, isLoading, error } = useQuery({
    queryKey,
    retry: false,
  });

  // Store sessionId when user data is received
  useEffect(() => {
    if (user?.sessionId) {
      setStoredSessionId(user.sessionId);
      
      // If we got a new session from role selection, clear the URL parameter
      if (roleParam) {
        const url = new URL(window.location.href);
        url.searchParams.delete('role');
        window.history.replaceState({}, '', url.toString());
      }
    } else if (error) {
      // Clear invalid session
      setStoredSessionId(null);
    }
  }, [user, error, roleParam]);

  const logout = () => {
    setStoredSessionId(null);
    window.location.href = '/api/logout';
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  };
}
