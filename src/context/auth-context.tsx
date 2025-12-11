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
    // This effect now runs whenever the firebase user's loading state or the user object itself changes.
    if (isUserLoading) {
      setLoading(true); // Always show loader while Firebase Auth is resolving.
      return;
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.includes(pathname);

    // If Firebase Auth has finished loading and there is no user:
    if (!firebaseUser) {
      setUserProfile(null);
      if (!isPublicPath) {
        router.push('/login'); // Redirect to login if not on a public page.
      }
      setLoading(false); // Auth resolved, no user, loading is done.
      return;
    }

    // If there IS a firebaseUser, fetch their profile from Firestore.
    if (firestore) {
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
            if (isPublicPath) {
              router.push('/'); // If user is logged in and on a public page, send to home.
            }
          } else {
            // This is an edge case. User exists in Auth but not in Firestore.
            // For now, treat as not fully logged in. Redirect to login.
            console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}.`);
            setUserProfile(null);
            if (!isPublicPath) {
              router.push('/login');
            }
          }
        })
        .catch((error) => {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
          if (!isPublicPath) {
            router.push('/login');
          }
        })
        .finally(() => {
          setLoading(false); // All async operations are done, stop loading.
        });
    } else {
        // Firestore is not yet available, which shouldn't happen if FirebaseClientProvider is set up correctly.
        setLoading(false);
    }
  }, [firebaseUser, isUserLoading, firestore, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root' || userProfile?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

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
