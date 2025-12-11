'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LogIn, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

// Helper to generate a random ID
const generateId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const initialChips = [
  { id: 1, value: 0.25, color: '#22c55e', name: 'Verde' },
  { id: 2, value: 0.5, color: '#ef4444', name: 'Vermelha' },
  { id: 3, value: 1, color: '#f5f5f5', name: 'Branca' },
  { id: 4, value: 10, color: '#171717', name: 'Preta' },
];

export default function CashGameLandingPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [newGameName, setNewGameName] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateGame = async () => {
    if (!newGameName.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, dê um nome para a sua sala.' });
      return;
    }
    setIsCreating(true);

    try {
      const gameId = generateId();
      const gameRef = doc(firestore, 'cashGames', gameId);
      
      await setDoc(gameRef, {
        id: gameId,
        name: newGameName,
        chips: initialChips,
        players: [],
        cashedOutPlayers: [],
        positionsSet: false,
        dealerId: null,
        createdAt: new Date().toISOString(),
      });

      toast({ title: 'Sala Criada!', description: `A sala "${newGameName}" foi criada com sucesso.` });
      router.push(`/cash-game/${gameId}`);

    } catch (error) {
      console.error("Error creating game: ", error);
      toast({ variant: 'destructive', title: 'Erro ao Criar Sala', description: 'Não foi possível criar a sala. Tente novamente.' });
      setIsCreating(false);
    }
  };

  const handleJoinGame = async () => {
    if (!joinGameId.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, insira o ID da sala.' });
      return;
    }
    setIsJoining(true);

    try {
        const gameRef = doc(firestore, 'cashGames', joinGameId.toUpperCase());
        const docSnap = await getDoc(gameRef);

        if (docSnap.exists()) {
            router.push(`/cash-game/${joinGameId.toUpperCase()}`);
        } else {
            toast({ variant: 'destructive', title: 'Sala não encontrada', description: 'Nenhuma sala encontrada com este ID. Verifique o código e tente novamente.' });
            setIsJoining(false);
        }
    } catch (error) {
        console.error("Error joining game: ", error);
        toast({ variant: 'destructive', title: 'Erro ao Entrar na Sala', description: 'Ocorreu um erro. Tente novamente.' });
        setIsJoining(false);
    }
  };


  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
       <div className="absolute top-8 left-8">
            <Button asChild variant="outline" size="icon">
                <Link href="/">
                <ArrowLeft />
                </Link>
            </Button>
        </div>
      <div className="w-full max-w-md space-y-8">
        {isAdmin && (
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent"><PlusCircle /> Criar Nova Sala</CardTitle>
                <CardDescription>Crie uma nova sala de Cash Game para você e seus amigos.</CardDescription>
            </CardHeader>
            <CardContent>
                <Input
                placeholder="Nome da Sala (Ex: Jogo de Terça)"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                disabled={isCreating}
                />
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={handleCreateGame} disabled={isCreating}>
                {isCreating ? 'Criando...' : 'Criar Sala'}
                </Button>
            </CardFooter>
            </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LogIn /> Entrar em uma Sala</CardTitle>
            <CardDescription>Já tem um código? Insira-o abaixo para entrar em uma sala existente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="ID da Sala"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              disabled={isJoining}
              maxLength={6}
              className="uppercase tracking-widest text-center font-mono"
            />
          </CardContent>
          <CardFooter>
            <Button variant="secondary" className="w-full" onClick={handleJoinGame} disabled={isJoining}>
              {isJoining ? 'Entrando...' : 'Entrar na Sala'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
