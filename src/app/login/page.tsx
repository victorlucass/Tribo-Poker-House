'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, LogIn, Smile } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const auth = useFirebaseAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!nickname || !password) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, preencha todos os campos.' });
      return;
    }
    setIsLoading(true);

    if (!auth || !firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviço de autenticação não disponível. Tente novamente em instantes.' });
      setIsLoading(false);
      return;
    }

    // Since we are not using real emails, we construct a fake email from the nickname.
    // This is required by Firebase Auth for password-based authentication.
    const emailToLogin = `${nickname.toLowerCase()}@tribo.poker`;

    try {
      await signInWithEmailAndPassword(auth, emailToLogin, password);
      toast({ title: 'Login bem-sucedido!', description: 'Bem-vindo de volta.' });
      router.push('/cash-game');
    } catch (error: any) {
      console.error(error);
      let description = 'Ocorreu um erro desconhecido.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = 'Apelido ou senha incorretos.';
      }
      toast({ variant: 'destructive', title: 'Falha no Login', description });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound /> Acesso</CardTitle>
          <CardDescription>Faça login com seu apelido para gerenciar e participar das salas de jogo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Apelido"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isLoading}
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button className="w-full" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? 'Entrando...' : <><LogIn className="mr-2"/> Entrar</>}
          </Button>
          <Button variant="link" asChild>
            <Link href="/signup">Não tem uma conta? Cadastre-se</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
