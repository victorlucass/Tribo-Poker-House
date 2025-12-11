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
    // This effect handles fetching the user profile from Firestore
    // once we have a firebase user and a firestore instance.
    const fetchUserProfile = async () => {
      if (firebaseUser && firestore) {
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            console.warn("User exists in Auth, but not in Firestore.", firebaseUser.uid);
            setUserProfile(null); // Explicitly set to null if no profile
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null); // No firebase user, so no profile
      }
    };
    
    fetchUserProfile();
  }, [firebaseUser, firestore]);

  useEffect(() => {
    // This effect manages the overall loading state.
    // The authentication process is considered "loading" until
    // Firebase Auth is initialized AND we have tried to fetch the user profile.
    if (isUserLoading) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [isUserLoading, userProfile]);

  useEffect(() => {
    // This effect handles redirection for protected routes.
    const publicPaths = ['/login', '/signup', '/facial-login'];
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

    // If loading is finished, there's no user, and we are on a protected path...
    if (!loading && !userProfile && !isPublicPath) {
      // ...redirect to login.
      router.push('/login');
    }
  }, [loading, userProfile, pathname, router]);


  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';

  const publicPaths = ['/login', '/signup', '/facial-login'];
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

  // If we are on a protected path and still loading, show a full screen loader.
  if (loading && !isPublicPath) {
    return <FullScreenLoader />;
  }

  // If we are on a public path, or if we are done loading and have a user, show the children.
  if (isPublicPath || (!loading && userProfile)) {
    return (
      <AuthContext.Provider value={{ user: userProfile, loading, isAdmin }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // If we are on a protected path, done loading, but have no user,
  // the redirect effect will handle it. Show a loader in the meantime.
  return <FullScreenLoader />;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
