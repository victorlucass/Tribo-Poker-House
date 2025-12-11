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
    const handleAuthChange = async () => {
      if (isUserLoading) {
        return; // Aguarda o hook useFirebaseUser terminar
      }

      if (firebaseUser && firestore) {
        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            console.warn("Perfil do usuário não encontrado no Firestore para UID:", firebaseUser.uid);
            setUserProfile(null); // Usuário autenticado mas sem perfil
          }
        } catch (error) {
          console.error("Erro ao buscar perfil do usuário:", error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null); // Nenhum usuário autenticado
      }
      
      setLoading(false); // Finaliza o carregamento geral aqui
    };

    handleAuthChange();
  }, [firebaseUser, isUserLoading, firestore]);
  
  useEffect(() => {
    // Este efeito lida APENAS com o redirecionamento e só executa quando o carregamento termina.
    if (loading) {
      return; 
    }

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

    if (!userProfile && !isPublicPath) {
      router.push('/login');
    }
    
    if (userProfile && isPublicPath) {
      router.push('/');
    }
  }, [loading, userProfile, pathname, router]);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'root';
  
  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

  // Mostra o loader enquanto a autenticação está em andamento,
  // ou se estivermos prestes a redirecionar de uma rota protegida.
  if (loading || (!userProfile && !isPublicPath)) {
    return <FullScreenLoader />;
  }

  return (
    <AuthContext.Provider value={{ user: userProfile, loading: loading, isAdmin }}>
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
