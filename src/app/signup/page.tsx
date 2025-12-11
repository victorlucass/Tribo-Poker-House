'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from 'firebase/auth';
import { useAuth as useFirebaseAuth, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { initiateEmailSignUp } from '@/firebase/non-blocking-login';

export default function SignupPage() {
  const router = useRouter();
  const auth = useFirebaseAuth();
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
    // If signup was initiated and we have a user, update their Auth profile.
    // The AuthProvider will handle creating the Firestore document.
    if (signupInitiated && firebaseUser && !isUserLoading) {
      updateProfile(firebaseUser, { displayName: name })
        .then(() => {
            toast({ title: 'Cadastro realizado!', description: 'Bem-vindo! Redirecionando...' });
            // The AuthProvider will handle redirection.
        })
        .catch((error) => {
            toast({ variant: 'destructive', title: 'Erro ao Salvar Perfil', description: 'Não foi possível salvar seu nome de usuário.' });
        })
        .finally(() => {
            setIsSigningUp(false);
            setSignupInitiated(false);
        });
    }
  }, [firebaseUser, isUserLoading, signupInitiated, name, router, toast]);


  const handleSignup = () => {
    if (!name || !nickname || !email || !password) {
        toast({ variant: 'destructive', title: 'Erro de Cadastro', description: 'Por favor, preencha todos os campos.' });
        return;
    }
    
    setIsSigningUp(true);

    if (!auth) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviços do Firebase não disponíveis. Tente novamente em instantes.' });
      setIsSigningUp(false);
      return;
    }

    try {
        setSignupInitiated(true);
        // This will trigger the onAuthStateChanged listener in AuthProvider
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
          <Button className="w-full" onClick={handleSignup} disabled={isSigningUp || isUserLoading}>
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
