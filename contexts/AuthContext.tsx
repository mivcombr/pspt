import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  authStatus?: string;
  error: string | null;
  setLoadingState: (loading: boolean) => void;
  retryFetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState('Verificando sessão...');

  const fetchProfile = async (userId: string, authUserEmail?: string) => {
    // Timeout of 5 seconds to prevent infinite hang
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
    );

    try {
      setAuthStatus('Carregando seu perfil...');

      // ... existing fetchPromise logic ...
      const fetchPromise = (async () => {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*, hospitals:hospital_id(name)')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.error('Database error fetching profile:', error);
          throw error; // Rethrow to be caught by the outer try-catch (local fallback)
        }

        if (!profile) {
          console.warn('Profile not found in database for user:', userId);
          // Instead of silent fallback, we set an error because an authenticated user MUST have a profile
          // This prevents the "downgrade" effect.
          throw new Error('Seu perfil não foi encontrado. Por favor, entre em contato com o administrador.');
        }

        return {
          id: profile.id,
          name: profile.name,
          role: (profile.role as string)?.toUpperCase() as UserRole,
          email: authUserEmail || '',
          avatar: profile.avatar_url || 'https://www.gravatar.com/avatar/?d=mp',
          hospitalId: profile.hospital_id,
          hospitalName: (profile.hospitals as any)?.name
        };
      })();

      const result = await Promise.race([fetchPromise, timeoutPromise]) as User;
      console.log('Final user role applied:', result.role);
      setUser(result);
      setError(null);
    } catch (err: any) {
      console.error('Critical error in fetchProfile:', err);
      setError(err.message || 'Erro ao carger perfil. Verifique sua conexão.');
      setUser(null);
    }
  };

  const retryFetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsLoading(true);
      setError(null);
      await fetchProfile(session.user.id, session.user.email);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    let isFetching = false;

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && active && !user) {
          isFetching = true;
          await fetchProfile(session.user.id, session.user.email);
        }
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        isFetching = false;
        if (active) setIsLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, !!session);

      try {
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
          if (!isFetching) {
            isFetching = true;
            await fetchProfile(session.user.id, session.user.email);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      } catch (err) {
        console.error('Error in onAuthStateChange handler:', err);
      } finally {
        isFetching = false;
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setIsLoading(true);

      // 1. Clear Supabase session
      await supabase.auth.signOut();

      // 2. Clear local storage explicitly (redundant but safe)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });

      // 3. Clear user state
      setUser(null);

      // 4. Redirect and reload to ensure a fresh state
      window.location.hash = '#/login';
      window.location.reload();
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
      window.location.hash = '#/login';
      window.location.reload();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut, isAuthenticated: !!user, authStatus, error, setLoadingState: setIsLoading, retryFetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};