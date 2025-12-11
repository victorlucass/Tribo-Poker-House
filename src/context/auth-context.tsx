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
    // This effect handles the entire auth flow: user check, profile fetch, and loading state.
    if (isUserLoading) {
      // Still waiting for Firebase Auth to initialize.
      return;
    }

    if (firebaseUser && firestore) {
      // User is authenticated with Firebase, now fetch their profile from Firestore.
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      getDoc(userDocRef)
        .then(docSnap => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // This case might happen if a user is created in Auth but their Firestore doc creation failed.
            console.warn("User profile not found in Firestore for UID:", firebaseUser.uid);
            setUserProfile(null);
          }
        })
        .catch(error => {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        })
        .finally(() => {
          // All async operations are done for a logged-in user.
          setLoading(false);
        });
    } else {
      // No Firebase user, so authentication is complete.
      setUserProfile(null);
      setLoading(false);
    }
  }, [firebaseUser, isUserLoading, firestore]);

  useEffect(() => {
    // This effect handles redirection and should ONLY run when the auth state is fully resolved (loading is false).
    if (loading) {
      return;
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

    if (!userProfile && !isPublicPath) {
      // If we are on a private path and there's definitively no user, redirect.
      router.push('/login');
    }
    
    if (userProfile && isPublicPath) {
      // If user is logged in and on a public page, redirect them to the app's main page
      router.push('/cash-game');
    }

  }, [loading, userProfile, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';
  
  // While loading, show a loader on private pages. Public pages can render immediately.
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));
  
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
