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
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
            <Skeleton className="h-48 w-full" />
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
    // This effect handles the entire auth flow sequentially.
    const manageAuthFlow = async () => {
      // 1. Wait for Firebase Auth to determine if a user is logged in.
      if (isUserLoading) {
        return; // Still waiting for Firebase...
      }

      // 2. If there's a Firebase user, try to fetch their profile from Firestore.
      if (firebaseUser && firestore) {
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            console.warn("User exists in Auth, but not in Firestore.", firebaseUser.uid);
            setUserProfile(null); // No profile found, treat as logged out.
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        } finally {
          // Finish loading only after Firestore lookup is complete.
          setLoading(false);
        }
      } else {
        // 3. If there's no Firebase user, there's no profile to fetch. Finish loading.
        setUserProfile(null);
        setLoading(false);
      }
    };

    manageAuthFlow();
  }, [firebaseUser, isUserLoading, firestore]);

  useEffect(() => {
    // This effect handles redirection and should only run AFTER the loading is complete.
    if (loading) {
      return; // Do not redirect while still loading.
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

    // If loading is finished, there's no user, and we are on a protected path...
    if (!userProfile && !isPublicPath) {
      // ...redirect to login.
      router.push('/login');
    }
  }, [loading, userProfile, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));
  
  // While loading, if we are on a protected path, show a full screen loader.
  if (loading && !isPublicPath) {
    return <FullScreenLoader />;
  }
  
  // If we are on a public path (like login), show it.
  // Or, if loading is done AND we have a user, show the protected content.
  if (isPublicPath || (!loading && userProfile)) {
      return (
          <AuthContext.Provider value={{ user: userProfile, loading, isAdmin }}>
              {children}
          </AuthContext.Provider>
      );
  }

  // This final case handles the moment on a protected path right after loading finishes
  // but before the redirection useEffect kicks in. It shows the loader to prevent a flicker.
  // It also correctly handles the logged-out state on protected paths.
  return <FullScreenLoader />;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
