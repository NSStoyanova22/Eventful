"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type CurrentUser = {
  _id: string;
  name: string;
  lastName: string;
  username: string;
  email: string;
  image?: string;
  role: "user" | "admin";
  country?: string;
};
export function useCurrentUser() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    
    if (status === "loading") return;

    
    if (!session?.user?.email) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/currentUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.user.email }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          setUser(null);
          setLoading(false);
          return;
        }
        throw new Error("Failed to fetch current user");
      }

      const data = await res.json();
      setUser(data.user ?? null);
    } catch (err: any) {
      console.error("Error fetching current user:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email, status]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    setUser,      
    loading,
    error,
    session,
    sessionStatus: status,
    refetchUser: fetchUser,
  };
}
