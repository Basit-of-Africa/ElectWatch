import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User } from '../types';
import { authenticateAndAuthorizeUser, PRIMARY_ADMIN_EMAIL } from '../lib/observerAuth';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isFieldSupervisor: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_CACHE_KEY = 'ivote_authorized_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(USER_CACHE_KEY);
    } catch {
      return true;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        // Fast-path: Hydrate immediately from cached authorized session so there is zero delay/flicker
        try {
          const cached = localStorage.getItem(USER_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as User;
            if (
              parsed && 
              (parsed.uid === fUser.uid || parsed.email?.trim().toLowerCase() === fUser.email?.trim().toLowerCase())
            ) {
              setUser(parsed);
              setLoading(false);
            }
          }
        } catch (e) {
          // ignore
        }

        // If currently offline, retain the local authorized profile without attempting network calls
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setLoading(false);
          return;
        }

        try {
          const authorizedUser = await authenticateAndAuthorizeUser(fUser);
          setUser(authorizedUser);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(authorizedUser));
          setAuthError(null);
        } catch (error: any) {
          console.warn("Auth check notice:", error?.message);
          const isExplicitDenial = error.message?.includes('Access Denied') || error.message?.includes('Account Suspended');

          if (isExplicitDenial) {
            setUser(null);
            setFirebaseUser(null);
            localStorage.removeItem(USER_CACHE_KEY);
            setAuthError(error.message);
          } else {
            // Transient network error / offline: ALWAYS preserve cached authorized user session
            const cached = localStorage.getItem(USER_CACHE_KEY);
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (
                  parsed && 
                  (parsed.uid === fUser.uid || parsed.email?.trim().toLowerCase() === fUser.email?.trim().toLowerCase())
                ) {
                  setUser(parsed);
                  setLoading(false);
                  return;
                }
              } catch (e) {
                // Ignore JSON parse error
              }
            }
          }
        }
      } else {
        // If fUser is null, check if we are currently offline and have a cached authorized session.
        // In offline environments, Firebase Auth might take time or fail to contact auth server,
        // so we must NEVER dump the cached user if navigator.onLine is false!
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const cached = localStorage.getItem(USER_CACHE_KEY);
        if (isOffline && cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.email) {
              setUser(parsed);
              setLoading(false);
              return;
            }
          } catch (e) {
            // ignore
          }
        }
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
      }
      setLoading(false);
    });

    // Re-verify in background when network reconnects
    const handleOnline = async () => {
      if (auth.currentUser) {
        try {
          const authorizedUser = await authenticateAndAuthorizeUser(auth.currentUser);
          setUser(authorizedUser);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(authorizedUser));
        } catch (err: any) {
          console.warn('Background reconnection auth notice:', err?.message);
        }
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const isSupervisor = user?.role === 'field_supervisor' || user?.role === 'supervisor';

  const value = {
    user,
    firebaseUser,
    loading,
    isAdmin: user?.role === 'admin' || firebaseUser?.email === PRIMARY_ADMIN_EMAIL,
    isSupervisor,
    isFieldSupervisor: isSupervisor,
    authError,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

