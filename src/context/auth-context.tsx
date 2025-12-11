'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser as useFirebaseUser, useFirestore as useFirebaseFirestore } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user: firebaseUser, isUserLoading: isFirebaseUserLoading } = useFirebaseUser();
  const firestore = useFirebaseFirestore();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Overall loading state depends on Firebase Auth and Firestore fetch
    if (isFirebaseUserLoading) {
      setLoading(true);
      return;
    }

    if (!firebaseUser) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      if (!firestore) {
        setLoading(false);
        return;
      }
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        // This case might happen if a user exists in Auth but not in Firestore.
        // You might want to handle this, e.g., by logging them out or creating a profile.
        console.warn("User exists in Auth, but not in Firestore.", firebaseUser.uid);
        setUserProfile(null);
      }
      setLoading(false);
    };

    fetchUserProfile();

  }, [firebaseUser, isFirebaseUserLoading, firestore]);

  const isAdmin = userProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user: userProfile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
