'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useFirebaseAuth } from '@/firebase';
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
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);

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
    
    // Store profile data temporarily for AuthProvider to pick it up
    try {
      sessionStorage.setItem('pendingUserProfile', JSON.stringify({ name, nickname }));
    } catch (e) {
      console.error("Could not set sessionStorage:", e);
      toast({ variant: 'destructive', title: 'Erro de Navegador', description: 'Não foi possível salvar os dados do perfil temporariamente. Verifique as configurações do seu navegador.' });
      setIsSigningUp(false);
      return;
    }

    initiateEmailSignUp(auth, email, password);
    // The AuthProvider will handle profile creation and redirection.
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
            onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
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
