'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const auth = useFirebaseAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !nickname || !email || !password) {
        toast({ variant: 'destructive', title: 'Erro de Cadastro', description: 'Por favor, preencha todos os campos.' });
        return;
    }
    
    setIsLoading(true);

    if (!auth || !firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Serviços do Firebase não disponíveis. Tente novamente em instantes.' });
      setIsLoading(false);
      return;
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: name,
      });

      // Determine user role
      // NEXT_PUBLIC_ADMIN_EMAIL is set in the .env file
      const isSuperAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL === email;
      const role = isSuperAdmin ? 'super_admin' : 'player';


      // Create user profile document in Firestore
      // The security rules allow a user to create their own document
      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        name,
        nickname,
        email: user.email,
        role: role,
      });

      toast({ title: 'Cadastro realizado com sucesso!', description: 'Você será redirecionado para a tela de login.' });
      router.push('/login');

    } catch (error: any) {
      console.error(error);
      let description = 'Ocorreu um erro desconhecido.';
      if (error.code === 'auth/email-already-in-use') {
        description = 'Este e-mail já está registrado. Tente fazer login ou use outro e-mail.';
      } else if (error.code === 'auth/weak-password') {
        description = 'A senha é muito fraca. Tente uma com pelo menos 6 caracteres.';
      } else if (error.code === 'auth/invalid-email') {
        description = 'O e-mail fornecido não é válido.';
      } else if (error.code === 'permission-denied') {
        description = 'Falha de permissão ao salvar o perfil. Verifique as regras de segurança do Firestore.'
      }
      toast({ variant: 'destructive', title: 'Falha no Cadastro', description });
    } finally {
      setIsLoading(false);
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
            disabled={isLoading}
          />
          <Input
            placeholder="Apelido"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isLoading}
          />
           <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button className="w-full" onClick={handleSignup} disabled={isLoading}>
            {isLoading ? 'Criando...' : 'Criar Conta'}
          </Button>
           <Button variant="link" asChild>
            <Link href="/login">Já tem uma conta? Faça login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
