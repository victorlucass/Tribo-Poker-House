'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
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
      // Check if nickname already exists
      const nicknameQuery = query(collection(firestore, "users"), where("nickname", "==", nickname));
      const nicknameSnapshot = await getDocs(nicknameQuery);
      if (!nicknameSnapshot.empty) {
        toast({ variant: 'destructive', title: 'Erro de Cadastro', description: 'Este apelido já está em uso. Por favor, escolha outro.' });
        setIsLoading(false);
        return;
      }

      // Step 1: Create user in Firebase Auth.
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Step 2: Create user profile document in Firestore.
      // This will now be handled by a Cloud Function, but we keep a client-side fallback
      // with updated security rules to allow it.
      await setDoc(doc(firestore, "users", user.uid), {
        uid: user.uid,
        name: name,
        nickname: nickname,
        email: email,
        role: 'player' // Default role for new users
      });


      // The onAuthStateChanged listener in AuthProvider will handle the redirect.
      toast({ title: 'Cadastro realizado com sucesso!', description: 'Você será redirecionado para a tela de login.' });
      router.push('/login');

    } catch (error: any) {
      console.error(error);
      let description = 'Ocorreu um erro desconhecido.';
      if (error.code === 'auth/email-already-in-use') {
        description = 'Este email já está sendo utilizado.';
      } else if (error.code === 'auth/weak-password') {
        description = 'A senha é muito fraca. Tente uma mais forte.';
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
            placeholder="Apelido (será visto na mesa)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isLoading}
          />
          <Input
            type="email"
            placeholder="Email"
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
