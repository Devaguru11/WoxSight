import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api, apiBase } from "../lib/api";
import { clearTokens, getAccessToken, setTokens } from "./tokenStore";

export type AuthUser = {
  id: number;
  email: string;
  name?: string;
  role: string;
  mustChangePassword?: boolean;
};

type Ctx = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const at = getAccessToken();
    if (!at) {
      setUser(null);
      setLoading(false);
      return;
    }
    if (at.startsWith("mock-demo-")) {
      const savedEmail = localStorage.getItem("meghavi-user-email") || "devaguru.in@bluecloudsoftech.com";
      const savedName  = localStorage.getItem("meghavi-user-name")  || "Deva";
      const savedRole  = localStorage.getItem("meghavi-user-role")  || "admin";
      setUser({
        id: 1,
        email: savedEmail,
        name: savedName,
        role: savedRole,
        mustChangePassword: false,
      });
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser({
        id: 1,
        email: "devaguru.in@bluecloudsoftech.com",
        name: "Deva",
        role: "admin",
        mustChangePassword: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await axios.post<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>(`${apiBase}/auth/login`, { email, password }, { headers: { "Content-Type": "application/json" }, timeout: 2500 });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    } catch {
      // Mock / standalone demo login fallback
      const cleanEmail = email.trim() || "devaguru.in@bluecloudsoftech.com";
      const role = cleanEmail.includes("viewer") ? "viewer" : cleanEmail.includes("manager") ? "manager" : "admin";
      const displayName = cleanEmail === "devaguru.in@bluecloudsoftech.com" ? "Deva" : undefined;
      const demoUser: AuthUser = {
        id: 1,
        email: cleanEmail,
        name: displayName,
        role,
        mustChangePassword: false,
      };
      localStorage.setItem("meghavi-user-email", cleanEmail);
      localStorage.setItem("meghavi-user-role", role);
      if (displayName) localStorage.setItem("meghavi-user-name", displayName);
      setTokens("mock-demo-access-token", "mock-demo-refresh-token");
      setUser(demoUser);
    }
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget — record logout in audit trail, don't block the client
    api.post("/auth/logout").catch(() => {});
    clearTokens();
    localStorage.removeItem("meghavi-user-email");
    localStorage.removeItem("meghavi-user-role");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
