import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Profile = { user_id: string; display_name: string | null };

export type FamilyAuthStatus = "loading" | "signed-out" | "needs-join" | "ready";

export function useFamilyAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<FamilyAuthStatus>("loading");

  const routeAuth = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      setUser(null);
      setProfile(null);
      setStatus("signed-out");
      return;
    }
    setUser(nextSession.user);
    const { data: member } = await supabase
      .from("cameron_family_members")
      .select("user_id")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();
    if (!member) {
      setProfile(null);
      setStatus("needs-join");
      return;
    }
    const { data: profileRow } = await supabase
      .from("cameron_profiles")
      .select("*")
      .eq("user_id", nextSession.user.id)
      .maybeSingle();
    setProfile(profileRow || null);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      routeAuth(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      routeAuth(nextSession);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [routeAuth]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    return data.session;
  }, []);

  const joinFamily = useCallback(async (code: string, displayName: string) => {
    const { data, error } = await supabase.rpc("join_cameron_family", {
      p_code: code,
      p_display_name: displayName,
    });
    if (error) throw error;
    if (!data) throw new Error("That family invite code does not match.");
    await routeAuth(session);
    return true;
  }, [routeAuth, session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { status, session, user, profile, signInWithPassword, signUp, joinFamily, signOut };
}
