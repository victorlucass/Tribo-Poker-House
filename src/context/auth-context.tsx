'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser as useFirebaseUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
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
    signOut(auth).then(() => {
      setUserProfile(null);
      router.push('/login'); // Force redirect after state is cleared
      toast({ title: 'Logout efetuado com sucesso.' });
    });
  }, [auth, toast, router]);

  useEffect(() => {
    const isPublicPath = ['/login', '/signup'].includes(pathname);

    if (isUserLoading) {
      setLoading(true);
      return;
    }

    if (!firebaseUser) {
      setUserProfile(null);
      if (!isPublicPath) {
        router.push('/login');
      } else {
        setLoading(false);
      }
      return;
    }
    
    if (firestore) {
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
            if (isPublicPath) {
              router.push('/');
            }
            setLoading(false);
          } else {
            // Profile doesn't exist, so let's create it.
            // This handles the race condition during signup.
            let name = firebaseUser.displayName || 'Novo Usuário';
            let nickname = firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.substring(0, 5)}`;
            
            try {
                const pendingProfile = sessionStorage.getItem('pendingUserProfile');
                if(pendingProfile) {
                    const profileData = JSON.parse(pendingProfile);
                    name = profileData.name;
                    nickname = profileData.nickname;
                    sessionStorage.removeItem('pendingUserProfile'); // Clean up
                }
            } catch (e) {
                console.error("Could not parse sessionStorage data:", e);
            }

            const isSuperAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL === firebaseUser.email;
            const role = isSuperAdmin ? 'super_admin' : 'player';

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: name,
              nickname: nickname,
              email: firebaseUser.email!,
              role: role,
            };
            
            setDocumentNonBlocking(userDocRef, newProfile, {});
            setUserProfile(newProfile); // Optimistically set the profile

            toast({ title: 'Bem-vindo!', description: 'Seu perfil foi criado.' });
            
            if (isPublicPath) {
                router.push('/');
            }
            setLoading(false);
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
