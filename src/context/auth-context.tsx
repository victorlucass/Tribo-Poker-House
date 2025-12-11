'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser as useFirebaseUser, useFirestore } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FullScreenLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background p-8">
    <div className="w-full max-w-md space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  </div>
);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user: firebaseUser, isUserLoading } = useFirebaseUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This effect is responsible for fetching the user profile and setting the final loading state.
    if (isUserLoading) {
      return; // Wait until Firebase Auth is ready
    }

    if (firebaseUser && firestore) {
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      getDoc(userDocRef)
        .then(docSnap => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            console.warn("User profile not found in Firestore for UID:", firebaseUser.uid);
            setUserProfile(null);
          }
        })
        .catch(error => {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // No firebaseUser, so no profile to fetch.
      setUserProfile(null);
      setLoading(false);
    }
  }, [firebaseUser, isUserLoading, firestore]);

  useEffect(() => {
    // This effect handles redirection and should only run when the auth state is fully resolved.
    if (loading) {
      return;
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p));
    
    // If we are on a private path and there's no user, redirect to login.
    if (!isPublicPath && !userProfile) {
        router.push('/login');
    }
  }, [loading, userProfile, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';
  
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));
  
  // While loading, show a loader on private pages. Public pages can render immediately.
  if (loading && !isPublicPath) {
    return <FullScreenLoader />;
  }

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
