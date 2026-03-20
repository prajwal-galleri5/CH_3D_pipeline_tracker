"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  isAdmin: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_access");
    if (saved === "true") {
      setIsAdmin(true);
    }
  }, []);

  const unlock = (password: string) => {
    // Simple admin password check
    if (password === "admin123") {
      setIsAdmin(true);
      localStorage.setItem("admin_access", "true");
      return true;
    }
    return false;
  };

  const lock = () => {
    setIsAdmin(false);
    localStorage.removeItem("admin_access");
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
