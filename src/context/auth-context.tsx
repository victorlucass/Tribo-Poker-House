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
    // Se o hook do Firebase ainda está carregando, não faça nada.
    if (isUserLoading) {
      return;
    }

    const processAuth = async () => {
      // Se não há usuário do Firebase e não há Firestore, não há nada a fazer.
      if (!firebaseUser || !firestore) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Se há usuário do Firebase, tente buscar o perfil no Firestore.
      try {
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const docSnap = await getDoc(userDocRef);
        setUserProfile(docSnap.exists() ? (docSnap.data() as UserProfile) : null);
      } catch (error) {
        console.error("Erro ao buscar perfil do usuário:", error);
        setUserProfile(null);
      } finally {
        // Apenas para de carregar DEPOIS de ter o perfil (ou a falta dele).
        setLoading(false);
      }
    };

    processAuth();
  }, [firebaseUser, isUserLoading, firestore]);
  
  useEffect(() => {
    // Só execute a lógica de roteamento DEPOIS que o carregamento inicial estiver concluído.
    if (loading) {
      return;
    }
  
    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.includes(pathname);
  
    // Se não há perfil de usuário e a rota não é pública, redireciona para o login.
    if (!userProfile && !isPublicPath) {
      router.push('/login');
    }
    // Se há perfil e a rota é pública, redireciona para a home.
    else if (userProfile && isPublicPath) {
      router.push('/');
    }
  }, [userProfile, loading, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';
  
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.includes(pathname);

  // Se estiver carregando, mostre o loader.
  // Se não estiver logado e não for uma página pública, mostre o loader para evitar piscar a tela durante o redirecionamento.
  if (loading || (!userProfile && !isPublicPath)) {
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
