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
  isSuperAdmin: boolean;
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
    // If the firebase user is still loading, we are loading.
    if (isUserLoading) {
      setLoading(true);
      return;
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.includes(pathname);
    
    // If there is no firebase user and we are not on a public path, redirect to login
    if (!firebaseUser) {
      setUserProfile(null);
      if (!isPublicPath) {
        router.push('/login');
      }
      setLoading(false);
      return;
    }

    // If there is a firebase user, but we don't have a firestore instance yet, we are loading.
    if (!firestore) {
      setLoading(true);
      return;
    }

    // Fetch user profile from Firestore
    const userDocRef = doc(firestore, 'users', firebaseUser.uid);
    getDoc(userDocRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          setUserProfile(profile);
          // If user is logged in and on a public path, redirect to home
          if (isPublicPath) {
            router.push('/');
          }
        } else {
          // This can happen on first signup before the doc is created.
          // Or if the user was deleted from Firestore but not from Auth.
          console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}. Logging out.`);
          setUserProfile(null);
          // signOut(getAuth()); // Consider signing out the user
          router.push('/login');
        }
      })
      .catch((error) => {
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
        router.push('/login');
      })
      .finally(() => {
        setLoading(false);
      });
      
  }, [firebaseUser, isUserLoading, firestore, pathname, router]);

  const isSuperAdmin = userProfile?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  if (loading) {
    return <FullScreenLoader />;
  }
  
  return (
    <AuthContext.Provider value={{ user: userProfile, loading, isAdmin, isSuperAdmin }}>
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
