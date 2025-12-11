'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser as useFirebaseUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

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
      // No need to push, useEffect will handle it.
      toast({ title: 'Logout efetuado com sucesso.' });
    });
  }, [auth, toast]);

  useEffect(() => {
    const isPublicPath = ['/login', '/signup'].includes(pathname);

    // If we're still waiting for Firebase Auth to initialize, show loader.
    if (isUserLoading) {
      setLoading(true);
      return;
    }

    // Firebase is initialized. If there's no user, redirect to login if not on a public path.
    if (!firebaseUser) {
      setUserProfile(null);
      if (!isPublicPath) {
        router.push('/login');
      } else {
        setLoading(false); // On public path, stop loading.
      }
      return;
    }
    
    // There is a Firebase user.
    if (firestore) {
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
            // Profile doesn't exist, so let's create it.
            // This handles the race condition during signup.
            const isSuperAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL === firebaseUser.email;
            const role = isSuperAdmin ? 'super_admin' : 'player';

            // Nickname is not available directly on user creation with email/password.
            // We'll need to retrieve it from the signup form.
            // For now, let's use a placeholder or derive from email.
            const derivedNickname = firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.substring(0, 5)}`;

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Novo Usuário',
              nickname: derivedNickname,
              email: firebaseUser.email!,
              role: role,
            };
            
            // Use a non-blocking write to avoid getting stuck here
            setDocumentNonBlocking(userDocRef, newProfile, {});
            setUserProfile(newProfile); // Optimistically set the profile

            toast({ title: 'Bem-vindo!', description: 'Seu perfil foi criado.' });
            
            if (isPublicPath) {
                router.push('/');
            } else {
                setLoading(false);
            }
          }
        })
        .catch((error) => {
          console.error("Error fetching/creating user profile:", error);
          toast({ variant: "destructive", title: "Erro de Perfil", description: "Não foi possível carregar ou criar o seu perfil." });
          handleLogout();
        });
    }

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
