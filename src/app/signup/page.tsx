'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useAuth as useFirebaseAuth, useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function SignupPage() {
  const router = useRouter();
  const auth = useFirebaseAuth();
  const firestore = useFirestore();
  const { user: firebaseUser, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupInitiated, setSignupInitiated] = useState(false);

  // This effect runs when the firebaseUser object changes after signup.
  useEffect(() => {
    if (signupInitiated && firebaseUser && !isUserLoading && firestore) {
      const finishSignup = async () => {
        try {
          // 1. Update Firebase Auth profile
          await updateProfile(firebaseUser, { displayName: name });

          // 2. Determine user role
          const isSuperAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL === email;
          const role = isSuperAdmin ? 'super_admin' : 'player';

          // 3. Create user profile in Firestore
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          setDocumentNonBlocking(userDocRef, {
            uid: firebaseUser.uid,
            name,
            nickname,
            email: firebaseUser.email,
            role: role,
          }, {});

          toast({ title: 'Cadastro realizado com sucesso!', description: 'Você será redirecionado para a tela de login.' });
          router.push('/login');

        } catch (error: any) {
           let description = 'Ocorreu um erro desconhecido ao finalizar o cadastro.';
            if (error.code === 'permission-denied') {
              description = 'Falha de permissão ao salvar o perfil. Verifique as regras de segurança do Firestore.'
            }
           toast({ variant: 'destructive', title: 'Falha no Cadastro', description });
        } finally {
            setIsSigningUp(false);
            setSignupInitiated(false);
        }
      }
      finishSignup();
    }
  }, [firebaseUser, isUserLoading, signupInitiated, firestore, name, nickname, email, router, toast]);


  const handleSignup = () => {
    if (!name || !nickname || !email || !password) {
        toast({ variant: 'destructive', title: 'Erro de Cadastro', description: 'Por favor, preencha todos os campos.' });
        return;
    }
    
    setIsSigningUp(true);

    if (!auth || !firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviços do Firebase não disponíveis. Tente novamente em instantes.' });
      setIsSigningUp(false);
      return;
    }

    try {
        setSignupInitiated(true);
        // This will trigger the onAuthStateChanged listener, and the useEffect above will complete the registration.
        initiateEmailSignUp(auth, email, password);
    } catch (error: any) {
        setSignupInitiated(false);
        setIsSigningUp(false);
        console.error(error);
        let description = 'Ocorreu um erro desconhecido.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'Este e-mail já está registrado. Tente fazer login ou use outro e-mail.';
        } else if (error.code === 'auth/weak-password') {
            description = 'A senha é muito fraca. Tente uma com pelo menos 6 caracteres.';
        } else if (error.code === 'auth/invalid-email') {
            description = 'O e-mail fornecido não é válido.';
        }
        toast({ variant: 'destructive', title: 'Falha no Cadastro', description });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus /> Criar Conta</CardTitle>
          <CardDescription>Crie sua conta para participar dos jogos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Nome Completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSigningUp}
          />
          <Input
            placeholder="Apelido"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isSigningUp}
          />
           <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSigningUp}
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSigningUp}
          />
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button className="w-full" onClick={handleSignup} disabled={isSigningUp}>
            {isSigningUp ? 'Criando...' : 'Criar Conta'}
          </Button>
           <Button variant="link" asChild>
            <Link href="/login">Já tem uma conta? Faça login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
