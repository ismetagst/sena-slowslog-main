import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Role } from "@/lib/types";

interface AuthUser {
  user: User | null;
  session: Session | null;
  profile: {
    id: string;
    user_id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    is_setup_complete: boolean;
  } | null;
  roles: Role[];
  loading: boolean;
  isFounder: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthUser>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: true,
  isFounder: false,
  isAdmin: false,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthUser["profile"]>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(p);

    const { data: r } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((r || []).map((x) => x.role as Role));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        isFounder: roles.includes("founder"),
        isAdmin: roles.includes("admin"),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
