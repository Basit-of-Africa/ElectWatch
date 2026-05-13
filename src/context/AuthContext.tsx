import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        // Fetch custom user data from Firestore for roles
        const userRef = doc(db, 'users', fUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setUser(userDoc.data() as User);
        } else {
          // Create user document if it doesn't exist yet (first login)
          const newUser: User = {
            uid: fUser.uid,
            displayName: fUser.displayName || 'Unknown',
            email: fUser.email || '',
            role: 'observer', // Default role
            createdAt: new Date().toISOString(),
          };
          try {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(userRef, newUser);
            setUser(newUser);
          } catch (error) {
            console.error("Error creating user profile:", error);
            setUser(newUser);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    firebaseUser,
    loading,
    isAdmin: user?.role === 'admin' || firebaseUser?.email === 'ajibadebasit40@gmail.com',
    isSupervisor: user?.role === 'supervisor',
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
