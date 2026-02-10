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
    // Timeout of 10 seconds to prevent infinite hang
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ao carregar perfil. Verifique sua conexão.')), 10000)
    );

    try {
      setAuthStatus('Carregando seu perfil...');

      const fetchPromise = (async () => {
        const { data: profile, error: dbError } = await supabase
          .from('profiles')
          .select('*, hospitals:hospital_id(name)')
          .eq('id', userId)
          .maybeSingle();

        if (dbError) {
          console.error('Database error fetching profile:', dbError);
          // Special case: if it's a transient DB error, we might want to keep the current user if exists
          throw dbError;
        }

        if (!profile) {
          console.warn('Profile not found in database for user:', userId);
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
        } as User;
      })();

      const result = await Promise.race([fetchPromise, timeoutPromise]) as User;
      console.log('Final user role applied:', result.role);
      setUser(result);
      setError(null);
    } catch (err: any) {
      console.error('Critical error in fetchProfile:', err);

      // IMPORTANT: Only clear user if we don't already have one or if it's a specific auth error
      // If we have a user and it's a DB error, we keep the user but show an error notification
      if (!user) {
        setError(err.message || 'Erro ao carregar perfil. Verifique sua conexão.');
        setUser(null);
      } else {
        // Just log the error, don't kick the user out if they were already logged in
        console.warn('Failed to refresh profile, keeping existing user state:', err.message);
      }
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
        } else if (event === 'TOKEN_REFRESHED') {
          // Token was successfully refreshed — session is still valid.
          // If we already have a user, no action needed. If not, fetch profile.
          console.log('[Auth] Token refreshed successfully.');
          if (!user && session && !isFetching) {
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

    // Periodic keep-alive: check session health every 4 minutes.
    // Browsers throttle setInterval in background tabs, so this is a safety net
    // for when the Supabase auto-refresh timer gets delayed.
    const keepAliveInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = session.expires_at ?? 0;
          // If token expires in less than 5 minutes, force refresh
          if (expiresAt - now < 300) {
            console.log('[Auth] Keep-alive: session near expiry, refreshing...');
            const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
            if (error) {
              console.warn('[Auth] Keep-alive refresh failed:', error.message);
            } else if (newSession) {
              console.log('[Auth] Keep-alive: session refreshed, new expiry:', new Date((newSession.expires_at ?? 0) * 1000).toLocaleString());
            }
          }
        }
      } catch (err) {
        console.warn('[Auth] Keep-alive error:', err);
      }
    }, 4 * 60 * 1000); // Every 4 minutes

    return () => {
      active = false;
      subscription.unsubscribe();
      clearInterval(keepAliveInterval);
    };
  }, []);

  const signOut = async () => {
    try {
      setIsLoading(true);

      // 1. Clear Supabase session
      await supabase.auth.signOut();

      // 2. Clear local storage explicitly (redundant but safe)
      localStorage.removeItem('pspt-auth-session');
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