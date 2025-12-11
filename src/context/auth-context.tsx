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
      // The useEffect hook will handle the redirect to /login
    });
  }, [auth, toast]);

  useEffect(() => {
    // Phase 1: Wait for Firebase Auth to be ready.
    if (isUserLoading) {
      setLoading(true);
      return;
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.includes(pathname);

    // Phase 2: Handle unauthenticated users.
    if (!firebaseUser) {
      setUserProfile(null);
      if (!isPublicPath) {
        // Use a timeout to ensure the current component has time to unmount
        // before the router pushes to a new page.
        setTimeout(() => router.push('/login'), 0);
      } else {
        setLoading(false);
      }
      return;
    }

    // Phase 3: Handle authenticated users.
    if (!firestore) {
      // This should ideally not happen if FirebaseProvider is set up correctly,
      // but it's a safe guard.
      setLoading(true);
      return;
    }

    const userDocRef = doc(firestore, 'users', firebaseUser.uid);
    getDoc(userDocRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          setUserProfile(profile);
          if (isPublicPath) {
            router.push('/');
          }
        } else {
          console.warn(`User profile not found for UID: ${firebaseUser.uid}. Logging out.`);
          handleLogout();
        }
      })
      .catch((error) => {
        console.error('Error fetching user profile:', error);
        handleLogout();
      })
      .finally(() => {
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
