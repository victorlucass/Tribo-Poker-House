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
    if (!auth) return;
    signOut(auth).then(() => {
      setUserProfile(null);
      router.push('/login');
      toast({ title: 'Logout efetuado com sucesso.' });
    });
  }, [auth, router, toast]);

  useEffect(() => {
    // 1. We are still waiting for Firebase to tell us if a user is logged in or not.
    if (isUserLoading) {
      setLoading(true);
      return;
    }

    const isPublicPath = ['/login', '/signup'].includes(pathname);

    // 2. Firebase has responded: There is NO user.
    if (!firebaseUser) {
      setUserProfile(null);
      // If we are not on a public page, redirect to login.
      if (!isPublicPath) {
        router.push('/login');
      } else {
        // If we are already on a public page, we can stop loading.
        setLoading(false);
      }
      return;
    }

    // 3. Firebase has responded: There IS a user.
    // Let's fetch their profile from Firestore.
    if (!firestore) return;

    const userDocRef = doc(firestore, 'users', firebaseUser.uid);
    getDoc(userDocRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          setUserProfile(profile);
           if (isPublicPath) {
             router.push('/');
           } else {
             setLoading(false);
           }
        } else {
          // This is a failsafe. If a user exists in Auth but not Firestore, log them out.
          console.warn(`User profile not found for UID: ${firebaseUser.uid}. Logging out.`);
          handleLogout();
        }
      })
      .catch((error) => {
        console.error('Error fetching user profile:', error);
        toast({ variant: 'destructive', title: 'Erro de Perfil', description: 'Não foi possível carregar seu perfil.' });
        handleLogout();
      })
      
  // We ONLY depend on these values. `pathname` and `router` can cause unwanted re-runs.
  }, [firebaseUser, isUserLoading, firestore, pathname, router, handleLogout, toast]);

  const isSuperAdmin = !!userProfile && userProfile.role === 'super_admin';
  const isAdmin = isSuperAdmin || (!!userProfile && userProfile.role === 'admin');

  const contextValue = {
    user: userProfile,
    loading,
    isAdmin,
    isSuperAdmin,
    handleLogout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {loading && !['/login', '/signup'].includes(pathname) ? <FullScreenLoader /> : children}
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
