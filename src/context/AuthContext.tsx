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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        try {
          const authorizedUser = await authenticateAndAuthorizeUser(fUser);
          setUser(authorizedUser);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(authorizedUser));
          setAuthError(null);
        } catch (error: any) {
          console.warn("Auth re-verification check:", error.message);
          const isExplicitDenial = error.message?.includes('Access Denied') || error.message?.includes('Account Suspended');

          if (isExplicitDenial) {
            setUser(null);
            setFirebaseUser(null);
            localStorage.removeItem(USER_CACHE_KEY);
            setAuthError(error.message);
          } else {
            // Transient network error during refresh: preserve cached authorized user session
            const cached = localStorage.getItem(USER_CACHE_KEY);
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (parsed && (parsed.uid === fUser.uid || parsed.email === fUser.email)) {
                  setUser(parsed);
                  setLoading(false);
                  return;
                }
              } catch (e) {
                // Ignore JSON parse error
              }
            }
            setUser(null);
            localStorage.removeItem(USER_CACHE_KEY);
            setAuthError(error.message || 'Authentication error.');
          }
        }
      } else {
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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

