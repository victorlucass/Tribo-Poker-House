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
    // Keep loading until firebase user state is resolved
    if (isUserLoading) {
      return;
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.includes(pathname);

    if (firebaseUser) {
      if (!firestore) {
        setLoading(true);
        return;
      }
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
            if (isPublicPath) {
              router.push('/');
            } else {
              setLoading(false);
            }
          } else {
            // Auth record exists, but no user profile in Firestore.
            setUserProfile(null);
            if (!isPublicPath) {
              router.push('/login');
            } else {
               setLoading(false);
            }
          }
        })
        .catch(() => {
          // Error fetching profile. Treat as logged out.
          setUserProfile(null);
          if (!isPublicPath) {
            router.push('/login');
          } else {
            setLoading(false);
          }
        });
    } else {
      // No firebase user
      setUserProfile(null);
      if (!isPublicPath) {
        router.push('/login');
      } else {
        setLoading(false);
      }
    }
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
