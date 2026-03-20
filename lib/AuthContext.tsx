"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  isAdmin: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In a real app, this would be a hash or server-side check.
// For this simple implementation, we'll use a local secret.
const ADMIN_SECRET = "admin123"; 

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hanuman_admin_mode");
    if (saved === "true") setIsAdmin(true);
  }, []);

  const unlock = (password: string) => {
    if (password === ADMIN_SECRET) {
      setIsAdmin(true);
      localStorage.setItem("hanuman_admin_mode", "true");
      return true;
    }
    return false;
  };

  const lock = () => {
    setIsAdmin(false);
    localStorage.removeItem("hanuman_admin_mode");
  };

  return (
    <AuthContext.Provider value={{ isAdmin, unlock, lock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
