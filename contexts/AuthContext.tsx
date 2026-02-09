import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  authStatus?: string;
  setLoadingState: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('Verificando sessão...');

  const fetchProfile = async (userId: string, authUserEmail?: string) => {
    // Timeout of 5 seconds to prevent infinite hang
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
    );

    try {
      setAuthStatus('Carregando seu perfil...');

      const fetchPromise = (async () => {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*, hospitals:hospital_id(name)')
          .eq('id', userId)
          .single();

        if (error || !profile) {
          console.warn('Profile not found or error, attempting minimal profile or creation:', error);

          // Try to create/upsert but with a short timeout as well
          const { data: newProfile, error: upsertError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              name: authUserEmail?.split('@')[0] || 'Usuário',
              role: 'RECEPTION',
              hospital_id: null
            }, { onConflict: 'id' })
            .select('*, hospitals:hospital_id(name)')
            .single();

          if (!upsertError && newProfile) {
            return {
              id: newProfile.id,
              name: newProfile.name,
              role: newProfile.role as UserRole,
              email: authUserEmail || '',
              avatar: newProfile.avatar_url || 'https://www.gravatar.com/avatar/?d=mp',
              hospitalId: newProfile.hospital_id,
              hospitalName: (newProfile.hospitals as any)?.name
            };
          }

          return {
            id: userId,
            name: authUserEmail?.split('@')[0] || 'Usuário',
            role: UserRole.RECEPTION,
            email: authUserEmail || '',
            avatar: 'https://www.gravatar.com/avatar/?d=mp'
          };
        }

        return {
          id: profile.id,
          name: profile.name,
          role: profile.role as UserRole,
          email: authUserEmail || '',
          avatar: profile.avatar_url || 'https://www.gravatar.com/avatar/?d=mp',
          hospitalId: profile.hospital_id,
          hospitalName: (profile.hospitals as any)?.name
        };
      })();

      const result = await Promise.race([fetchPromise, timeoutPromise]) as User;
      setUser(result);
    } catch (err) {
      console.error('Error or timeout in fetchProfile:', err);
      setUser({
        id: userId,
        name: authUserEmail?.split('@')[0] || 'Usuário',
        role: UserRole.RECEPTION,
        email: authUserEmail || '',
        avatar: 'https://www.gravatar.com/avatar/?d=mp'
      });
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
    <AuthContext.Provider value={{ user, isLoading, signOut, isAuthenticated: !!user, authStatus, setLoadingState: setIsLoading }}>
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