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
    // Don't do anything until Firebase Auth has initialized
    if (isUserLoading) {
      return;
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

    // If there's a logged-in user, fetch their profile
    if (firebaseUser && firestore) {
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      getDoc(userDocRef)
        .then(docSnap => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // This can happen if the user is deleted from Firestore but not from Auth
            console.warn("User profile not found in Firestore for UID:", firebaseUser.uid);
            setUserProfile(null);
            // If they are on a protected path, they need to be redirected
            if (!isPublicPath) {
              router.push('/login');
            }
          }
        })
        .catch(error => {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
           if (!isPublicPath) {
             router.push('/login');
           }
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // No user is logged in
      setUserProfile(null);
      setLoading(false);
      // If the user is not on a public path, redirect them
      if (!isPublicPath) {
        router.push('/login');
      }
    }
  }, [firebaseUser, isUserLoading, firestore, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));
  
  // While any authentication logic is running, show a loader on protected pages.
  if (loading && !isPublicPath) {
    return <FullScreenLoader />;
  }

  // If we are on a public path, or if loading is done and we have a user, show the content.
  if (isPublicPath || (!loading && userProfile)) {
    return (
      <AuthContext.Provider value={{ user: userProfile, loading, isAdmin }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // For any other case (e.g., logged out on a protected route after loading), show the loader
  // This prevents content flashing before the redirect useEffect kicks in.
  return <FullScreenLoader />;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
