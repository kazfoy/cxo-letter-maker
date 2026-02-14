'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { migrateFromLocalStorage } from '@/lib/supabaseHistoryUtils';
import { devLog } from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Migrate LocalStorage data if user is logged in
      if (session?.user) {
        migrateFromLocalStorage().then((result) => {
          if (!result.success) {
            devLog.error('Migration failed:', result.error);
          }
        });
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Migrate LocalStorage data when user logs in
      if (session?.user) {
        migrateFromLocalStorage().then((result) => {
          if (!result.success) {
            devLog.error('Migration failed:', result.error);
          }
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // Redirect to dashboard after successful login
    window.location.href = '/dashboard';
  };

  const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }

    // Check if email confirmation is required
    // If user is immediately available, redirect to dashboard
    // If not, the user needs to check their email for confirmation
    if (data.user && data.session) {
      // User is auto-confirmed (development mode or auto-confirm enabled)
      window.location.href = '/dashboard';
    }
    // If no session but user exists, email confirmation is required
    // The UI should show a message (handled by the login page)
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    // Redirect to login after signout
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithPassword, signUpWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
