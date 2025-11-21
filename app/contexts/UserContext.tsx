"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

type User = {
  _id: string;
  name: string;
  lastName: string;
  username: string;
  email: string;
  image?: string;
  role: "user" | "admin";
  country?: string;
};

type UserContextType = {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateUserImage: (imageUrl: string) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
          return;
        }
        throw new Error("Failed to fetch user");
      }

      const data = await res.json();
      setUser(data.user ?? null);
    } catch (err: any) {
      console.error("Error fetching user:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email, status]);

  useEffect(() => {
    fetchUser();

    const handleImageUpdate = (event: any) => {
      if (event.detail?.imageUrl) {
        setUser((prev) => prev ? { ...prev, image: event.detail.imageUrl } : null);
      }
    };

    window.addEventListener('profileImageUpdated', handleImageUpdate);
    return () => window.removeEventListener('profileImageUpdated', handleImageUpdate);
  }, [fetchUser]);

  const updateUserImage = useCallback((imageUrl: string) => {
    setUser((prev) => prev ? { ...prev, image: imageUrl } : null);
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error, refetch: fetchUser, updateUserImage }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
