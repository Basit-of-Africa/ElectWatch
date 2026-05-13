import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, UserRole } from '../types';

const SESSION_ID_KEY = 'civicwatch.specialId';

const demoUsers: Record<string, Omit<User, 'uid' | 'createdAt'>> = {
  'CW-ADMIN': {
    displayName: 'Command Admin',
    email: 'admin@civicwatch.local',
    role: 'admin',
  },
  'CW-SUP': {
    displayName: 'Regional Supervisor',
    email: 'supervisor@civicwatch.local',
    role: 'supervisor',
  },
  'CW-OBS': {
    displayName: 'Field Observer',
    email: 'observer@civicwatch.local',
    role: 'observer',
    assignedPollingUnitId: 'PU-LAG-102',
  },
};

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  loginWithSpecialId: (specialId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeSpecialId(value: string) {
  return value.trim().toUpperCase();
}

function getDemoUser(specialId: string) {
  return demoUsers[specialId] || null;
}

async function findUserBySpecialId(specialId: string): Promise<Omit<User, 'uid' | 'createdAt'> | null> {
  const demoUser = getDemoUser(specialId);
  if (demoUser) return demoUser;

  const directSnap = await getDoc(doc(db, 'users', specialId));
  if (directSnap.exists()) {
    const data = directSnap.data() as User;
    return {
      displayName: data.displayName,
      email: data.email,
      role: data.role,
      assignedPollingUnitId: data.assignedPollingUnitId,
    };
  }

  const lookup = query(collection(db, 'users'), where('specialId', '==', specialId), limit(1));
  const lookupSnap = await getDocs(lookup);
  if (lookupSnap.empty) return null;

  const data = lookupSnap.docs[0].data() as User;
  return {
    displayName: data.displayName,
    email: data.email,
    role: data.role,
    assignedPollingUnitId: data.assignedPollingUnitId,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loginWithSpecialId = async (rawSpecialId: string) => {
    const specialId = normalizeSpecialId(rawSpecialId);
    if (!specialId) throw new Error('Enter your special ID.');

    const profile = await findUserBySpecialId(specialId);
    if (!profile) {
      await signOut(auth);
      throw new Error('Special ID not recognized.');
    }

    const demoUser = getDemoUser(specialId);
    let uid = demoUser ? `demo-${specialId.toLowerCase()}` : auth.currentUser?.uid;
    let credential: FirebaseUser | null = auth.currentUser;

    try {
      credential = auth.currentUser || (await signInAnonymously(auth)).user;
      uid = credential.uid;
    } catch (error) {
      if (!demoUser) throw error;
      console.warn('Firebase anonymous sign-in unavailable; using local demo session.', error);
    }

    const sessionUser: User = {
      uid,
      displayName: profile.displayName,
      email: profile.email || `${specialId.toLowerCase()}@civicwatch.local`,
      role: profile.role as UserRole,
      assignedPollingUnitId: profile.assignedPollingUnitId,
      createdAt: new Date().toISOString(),
    };

    if (credential) {
      try {
        await setDoc(doc(db, 'users', credential.uid), sessionUser, { merge: true });
      } catch (error) {
        if (!demoUser) throw error;
        console.warn('Demo profile could not be written to Firestore; continuing with local session.', error);
      }
    }

    localStorage.setItem(SESSION_ID_KEY, specialId);
    setFirebaseUser(credential || null);
    setUser(sessionUser);
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_ID_KEY);
    setUser(null);
    setFirebaseUser(null);
    if (auth.currentUser) await signOut(auth);
  };

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      if (cancelled) return;
      setFirebaseUser(fUser);

      const storedSpecialId = localStorage.getItem(SESSION_ID_KEY);
      if (!storedSpecialId) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        await loginWithSpecialId(storedSpecialId);
      } catch (error) {
        console.error('Special ID session restore failed:', error);
        localStorage.removeItem(SESSION_ID_KEY);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value = {
    user,
    firebaseUser,
    loading,
    isAdmin: user?.role === 'admin',
    isSupervisor: user?.role === 'supervisor',
    loginWithSpecialId,
    logout,
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
