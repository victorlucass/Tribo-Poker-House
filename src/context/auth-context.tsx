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
    // This single, unified effect handles the entire auth flow:
    // 1. Wait for Firebase Auth to be ready.
    // 2. If user exists, fetch their Firestore profile.
    // 3. Once all data is (or isn't) fetched, update loading state.
    // 4. Based on final state, perform any necessary redirection.
    const handleAuthFlow = async () => {
      if (isUserLoading || !firestore) {
        // If Firebase Auth is still initializing or Firestore is not ready, we wait.
        // setLoading(true) is the default state, so we don't need to set it here.
        return;
      }

      let finalProfile: UserProfile | null = null;

      if (firebaseUser) {
        // User is authenticated with Firebase, try to fetch their profile.
        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            finalProfile = docSnap.data() as UserProfile;
          } else {
            // This can happen if profile creation is delayed or failed.
            // Treat user as not fully logged in for app purposes.
            console.warn("User profile not found in Firestore for UID:", firebaseUser.uid);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
      
      // Set the final profile state
      setUserProfile(finalProfile);

      // Now, with the definitive user state, handle routing logic.
      const publicPaths = ['/login', '/signup'];
      const isPublicPath = publicPaths.includes(pathname);

      if (finalProfile && isPublicPath) {
        // Logged-in user on a public page, redirect to home.
        router.push('/');
      } else if (!finalProfile && !isPublicPath) {
        // Not-logged-in user on a protected page, redirect to login.
        router.push('/login');
      } else {
        // All other cases are valid (e.g., logged-in on protected page, not-logged-in on public page).
        // We can now safely finish loading.
        setLoading(false);
      }
    };

    handleAuthFlow();
  }, [firebaseUser, isUserLoading, firestore, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';
  
  if (loading) {
    return <FullScreenLoader />;
  }

  // Once loading is false, render children. The useEffect has already handled redirects.
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
