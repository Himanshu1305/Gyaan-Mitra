"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  subscriptionTier: string;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

function friendlyAuthError(msg: string): string {
  if (msg === "Invalid login credentials") return "Incorrect email or password. Please try again.";
  if (msg.toLowerCase().includes("invalid api key")) return "Authentication service is misconfigured. Please contact support.";
  if (msg.toLowerCase().includes("email not confirmed")) return "Please verify your email address before signing in.";
  if (msg.toLowerCase().includes("user already registered")) return "An account with this email already exists. Try signing in instead.";
  if (msg.toLowerCase().includes("password should be")) return "Password must be at least 6 characters.";
  if (msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) return "Network error. Please check your connection and try again.";
  return msg;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  subscriptionTier: "free",
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState("free");

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("is_admin, subscription_tier")
      .eq("id", userId)
      .single();
    setIsAdmin(data?.is_admin === true);
    setSubscriptionTier(data?.subscription_tier ?? "free");
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsAdmin(false);
        setSubscriptionTier("free");
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? friendlyAuthError(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: friendlyAuthError(error.message) };

    // Create profile record immediately after signup
    if (data.user) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("profiles").upsert([{
          id: data.user.id,
          email: data.user.email,
          full_name: fullName,
          subscription_tier: "free",
          is_admin: false,
          communication_preferences: { newsletters: true, product_updates: true, teaching_tips: true },
        }], { onConflict: "id" });
      } catch { /* trigger may have already created it — non-critical */ }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, subscriptionTier, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
