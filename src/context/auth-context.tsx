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
    // Let the firebase hook finish its loading first.
    if (isUserLoading) {
      return;
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.includes(pathname);

    const processAuth = async () => {
      // If there's no authenticated firebase user...
      if (!firebaseUser) {
        setUserProfile(null);
        if (!isPublicPath) {
          router.push('/login');
        }
        setLoading(false);
        return;
      }
      
      // If there is a firebase user, fetch their profile from Firestore.
      if (!firestore) {
        console.error("Firestore service is not available.");
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          setUserProfile(profile);
          if (isPublicPath) {
            router.push('/');
          }
        } else {
          // This is an invalid state: user is in Auth but not Firestore.
          // For safety, sign them out and redirect to login.
          console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}. Forcing logout.`);
          setUserProfile(null);
          // Actual signOut() call is in page components, redirecting is the key action here.
          if (!isPublicPath) {
            router.push('/login');
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
        if (!isPublicPath) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    
    processAuth();
  }, [firebaseUser, isUserLoading, firestore, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';

  if (loading) {
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
