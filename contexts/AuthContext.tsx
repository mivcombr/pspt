import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
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

  // useRef to always have the latest user value — avoids stale closure bugs
  // where callbacks captured an old (null) user and incorrectly cleared state.
  const userRef = useRef<User | null>(null);
  const isFetchingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchProfile = useCallback(async (userId: string, authUserEmail?: string) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[Auth] fetchProfile skipped — already fetching.');
      return;
    }

    // If we already have a user loaded, skip re-fetching on auth events
    if (userRef.current) {
      console.log('[Auth] fetchProfile skipped — user already loaded:', userRef.current.role);
      return;
    }

    isFetchingRef.current = true;

    // Timeout of 20 seconds (increased from 10s to handle slow connections)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ao carregar perfil. Verifique sua conexão.')), 20000)
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
      console.log('[Auth] Profile loaded, role:', result.role);
      setUser(result);
      setError(null);
    } catch (err: any) {
      console.error('[Auth] Error in fetchProfile:', err);

      // CRITICAL FIX: Use userRef.current (latest value) instead of stale `user` closure.
      // This prevents clearing a valid user on transient errors (e.g. timeout during token refresh).
      if (!userRef.current) {
        setError(err.message || 'Erro ao carregar perfil. Verifique sua conexão.');
        // Do NOT call setUser(null) here — it's already null, and setting it again
        // can trigger unnecessary re-renders.
      } else {
        // User is already logged in — a transient fetch failure should NOT log them out.
        console.warn('[Auth] Transient error, keeping existing user session:', err.message);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const retryFetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsLoading(true);
      setError(null);
      // Force re-fetch even if user exists
      userRef.current = null;
      setUser(null);
      await fetchProfile(session.user.id, session.user.email);
      setIsLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && active) {
          await fetchProfile(session.user.id, session.user.email);
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event, !!session);

      try {
        if (event === 'SIGNED_OUT') {
          userRef.current = null;
          setUser(null);
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          // Token refreshed successfully — session is still valid, no action needed.
          console.log('[Auth] Token refreshed. User present:', !!userRef.current);
          return;
        }

        // For SIGNED_IN, INITIAL_SESSION, USER_UPDATED — only fetch profile if we don't have one
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
          if (!userRef.current) {
            await fetchProfile(session.user.id, session.user.email);
          }
        }
      } catch (err) {
        console.error('[Auth] Error in onAuthStateChange handler:', err);
      } finally {
        setIsLoading(false);
      }
    });

    // Periodic keep-alive: check session health every 4 minutes.
    // Browsers throttle timers in background tabs, so this is a safety net.
    const keepAliveInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = session.expires_at ?? 0;
          if (expiresAt - now < 300) {
            console.log('[Auth] Keep-alive: session near expiry, refreshing...');
            const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
            if (error) {
              console.warn('[Auth] Keep-alive refresh failed:', error.message);
            } else if (newSession) {
              console.log('[Auth] Keep-alive: refreshed, expires:', new Date((newSession.expires_at ?? 0) * 1000).toLocaleString());
            }
          }
        }
      } catch (err) {
        console.warn('[Auth] Keep-alive error:', err);
      }
    }, 4 * 60 * 1000);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearInterval(keepAliveInterval);
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
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
      userRef.current = null;
      setUser(null);

      // 4. Redirect and reload to ensure a fresh state
      window.location.hash = '#/login';
      window.location.reload();
    } catch (err) {
      console.error('Logout error:', err);
      userRef.current = null;
      setUser(null);
      window.location.hash = '#/login';
      window.location.reload();
    } finally {
      setIsLoading(false);
    }
  }, []);

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