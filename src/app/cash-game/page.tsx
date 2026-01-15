'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LogIn, LogOut, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import type { JoinRequest } from '@/lib/types';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const generateId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const initialChips = [
  { id: 1, value: 1, color: 'white', name: 'Branca' },
  { id: 2, value: 5, color: 'red', name: 'Vermelha' },
  { id: 3, value: 10, color: 'blue', name: 'Azul' },
  { id: 4, value: 25, color: 'green', name: 'Verde' },
  { id: 5, value: 50, color: 'turquoise', name: 'Turquesa' },
  { id: 6, value: 100, color: 'black', name: 'Preta' },
];

const initialInventory = {
  white: 199,
  red: 100,
  blue: 50,
  green: 50,
  turquoise: 50,
  black: 50,
};

export default function CashGameLandingPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, isAdmin, handleLogout } = useAuth();
  const [newGameName, setNewGameName] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateGame = async () => {
    if (!newGameName.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, dê um nome para a sua sala.' });
      return;
    }
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Você precisa estar logado para criar uma sala.' });
      return;
    }
    if (!isAdmin) {
      toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Apenas administradores podem criar salas.' });
      return;
    }
    setIsCreating(true);

    try {
      const gameId = generateId();
      const gameRef = doc(firestore, 'cashGames', gameId);

      setDocumentNonBlocking(gameRef, {
        id: gameId,
        name: newGameName,
        chips: initialChips,
        chipInventory: initialInventory,
        players: [],
        cashedOutPlayers: [],
        requests: [],
        positionsSet: false,
        dealerId: null,
        croupierId: null,
        createdAt: new Date().toISOString(),
        ownerId: user.uid,
      }, {});

      toast({ title: 'Sala Criada!', description: `A sala "${newGameName}" foi criada com sucesso.` });
      router.push(`/cash-game/${gameId}`);
    } catch (error) {
      console.error('Error creating game: ', error);
      toast({ variant: 'destructive', title: 'Erro ao Criar Sala', description: 'Não foi possível criar a sala. Verifique as regras de segurança e tente novamente.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGame = async () => {
    if (!joinGameId.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Por favor, insira o ID da sala.' });
      return;
    }
    
    // We only need firestore to be available
    if (!firestore) return;

    setIsJoining(true);
    const gameId = joinGameId.toUpperCase();

    try {
      const gameRef = doc(firestore, 'cashGames', gameId);
      const docSnap = await getDoc(gameRef);

      if (docSnap.exists()) {
        const gameData = docSnap.data();
        
        // If user is not logged in, they can only spectate
        if (!user) {
             router.push(`/cash-game/${gameId}`);
             return;
        }

        // Admin or game owner can join directly
        if (isAdmin || gameData.ownerId === user.uid) {
          router.push(`/cash-game/${gameId}`);
          return;
        }

        const isPlayer = gameData.players.some((p: any) => p.id === user.uid);
        const hasCashedOut = gameData.cashedOutPlayers.some((p: any) => p.id === user.uid);
        const existingRequest = gameData.requests.find((r: any) => r.userId === user.uid);

        if (isPlayer || hasCashedOut) {
           router.push(`/cash-game/${gameId}`);
           return;
        }

        if (existingRequest) {
            if(existingRequest.status === 'declined') {
                toast({ variant: 'destructive', title: 'Solicitação Recusada', description: 'Seu pedido para entrar na sala foi recusado pelo administrador.' });
                setIsJoining(false);
                return;
            }
            // If pending or approved, let them in to spectate or play
            router.push(`/cash-game/${gameId}`);
            return;
        }

        // No request exists, create a new one
        const newRequest: JoinRequest = {
          userId: user.uid,
          userName: user.nickname,
          status: 'pending',
          requestedAt: new Date().toISOString(),
        };

        updateDocumentNonBlocking(gameRef, {
          requests: arrayUnion(newRequest),
        });

        toast({ title: 'Solicitação Enviada!', description: 'Seu pedido para entrar na sala foi enviado. Você será redirecionado.' });
        router.push(`/cash-game/${gameId}`);

      } else {
        toast({ variant: 'destructive', title: 'Sala não encontrada', description: 'Nenhuma sala encontrada com este ID. Verifique o código e tente novamente.' });
      }
    } catch (error) {
      console.error('Error joining game: ', error);
      toast({ variant: 'destructive', title: 'Erro ao Entrar na Sala', description: 'Ocorreu um erro. Tente novamente.' });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
       <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button asChild variant="outline" size="icon">
          <Link href="/">
            <ArrowLeft />
          </Link>
        </Button>
      </div>
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
        <Button variant="outline" onClick={handleLogout} size="sm">
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
      <div className="w-full max-w-md space-y-8">
        {isAdmin && (
            <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                <PlusCircle /> Criar Nova Sala
                </CardTitle>
                <CardDescription>Crie uma nova sala de Cash Game para você e seus amigos.</CardDescription>
            </CardHeader>
            <CardContent>
                <Input placeholder="Nome da Sala (Ex: Jogo de Terça)" value={newGameName} onChange={(e) => setNewGameName(e.target.value)} disabled={isCreating} />
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
            <CardTitle className="flex items-center gap-2">
              <LogIn /> Entrar em uma Sala
            </CardTitle>
            <CardDescription>Já tem um código? Insira-o abaixo para entrar ou solicitar acesso a uma sala.</CardDescription>
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
              {isJoining ? 'Processando...' : 'Entrar ou Solicitar'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

    