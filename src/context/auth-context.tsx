'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser as useFirebaseUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  handleLogout: () => void;
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
  const auth = useFirebaseAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(() => {
    signOut(auth).then(() => {
      toast({ title: 'Logout efetuado com sucesso.' });
      // The useEffect below will handle the redirect to /login
    });
  }, [auth, toast]);

  useEffect(() => {
    // Still waiting for Firebase Auth to initialize and check the user's status.
    if (isUserLoading) {
      setLoading(true);
      return;
    }

    const isPublicPath = ['/login', '/signup'].includes(pathname);

    // If no user is logged in
    if (!firebaseUser) {
      setUserProfile(null);
      if (!isPublicPath) {
        router.push('/login');
      } else {
        setLoading(false);
      }
      return;
    }

    // If a user is logged in, fetch their profile from Firestore
    const userDocRef = doc(firestore, 'users', firebaseUser.uid);
    getDoc(userDocRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          setUserProfile(profile);
          // If they are on a public path (like login), redirect them to home
          if (isPublicPath) {
            router.push('/');
          }
        } else {
          // This case should be rare, but if there's an auth record without a user doc, log them out.
          console.warn(`User profile not found for UID: ${firebaseUser.uid}. Logging out.`);
          handleLogout();
        }
      })
      .catch((error) => {
        console.error('Error fetching user profile:', error);
        handleLogout();
      })
      .finally(() => {
        // Only stop loading after all async operations for an authenticated user are complete.
        setLoading(false);
      });
  }, [firebaseUser, isUserLoading, firestore, pathname, router, handleLogout]);

  const isSuperAdmin = userProfile?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  const contextValue = {
    user: userProfile,
    loading,
    isAdmin,
    isSuperAdmin,
    handleLogout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {loading ? <FullScreenLoader /> : children}
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
