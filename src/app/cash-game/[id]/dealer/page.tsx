'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { CashGame, HandState, Pot } from '@/lib/types';
import PokerTable from '@/components/poker-table';
import DealerControls from '@/components/cash-game/dealer-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';

export default function DealerPage() {
  const params = useParams();
  const gameId = params.id as string;
  const router = useRouter();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const firestore = useFirestore();

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'cashGames', gameId);
  }, [firestore, gameId]);

  const { data: game, status } = useDoc<CashGame>(gameRef);

  const [showCommunityCardAnimation, setShowCommunityCardAnimation] = useState(false);
  const [previousPhase, setPreviousPhase] = useState<string | undefined>(undefined);

  const canManageGame = isAdmin || isSuperAdmin || (game?.ownerId === user?.uid);

  // Set this user as the croupier on entering the page, and release on unmount.
  // This effect runs only once on mount.
  useEffect(() => {
    if (!gameRef || !user || !canManageGame) return;

    const claimCroupierSeat = async () => {
      try {
        const freshGameDoc = await getDoc(gameRef);
        if (!freshGameDoc.exists()) return;
        const freshGameData = freshGameDoc.data() as CashGame;

        if (!freshGameData.croupierId || freshGameData.croupierId === user.uid) {
           updateDocumentNonBlocking(gameRef, { croupierId: user.uid });
        }
        // If the seat is already taken by someone else, the UI below will handle showing the error.
      } catch (error) {
         console.error("Failed to claim croupier seat:", error);
         toast({variant: 'destructive', title: "Erro de Conexão", description: "Não foi possível verificar a vaga de Croupier."})
      }
    };

    claimCroupierSeat();
    
    return () => {
      // Use getDoc for a final check before releasing the seat.
      // This avoids race conditions where the component might unmount
      // and another user might have already taken the seat.
      getDoc(gameRef).then(docSnap => {
        if (docSnap.exists() && docSnap.data().croupierId === user.uid) {
           updateDocumentNonBlocking(gameRef, { croupierId: null });
        }
      }).catch(err => console.error("Failed to release croupier seat:", err));
    };
  // The dependency array is intentionally limited to ensure this runs only on mount/unmount and identity changes.
  // We do not want to re-run this every time `game` data changes.
  }, [gameRef, user?.uid, canManageGame, toast]);
  
  // Monitor phase changes to trigger animations
  useEffect(() => {
    const currentPhase = game?.handState?.phase;
    if (currentPhase && currentPhase !== previousPhase) {
      if (currentPhase === 'FLOP' || currentPhase === 'TURN' || currentPhase === 'RIVER') {
        setShowCommunityCardAnimation(true);
        const timer = setTimeout(() => setShowCommunityCardAnimation(false), 1000); // Animation duration
        return () => clearTimeout(timer);
      }
    }
    setPreviousPhase(currentPhase);
  }, [game?.handState?.phase, previousPhase]);


  const updateHandState = useCallback(
    (handState: Partial<HandState> | null) => {
      if (!gameRef) return;
      // Using `handState: handState ?? null` ensures field is deleted if null is passed
      updateDocumentNonBlocking(gameRef, { handState: handState ?? null });
    },
    [gameRef]
  );
  
  const updateGame = useCallback(
    (gameData: Partial<CashGame>) => {
      if (!gameRef) return;
      updateDocumentNonBlocking(gameRef, gameData);
    },
    [gameRef]
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-black p-4">
        <Skeleton className="aspect-video w-full max-w-5xl" />
        <Skeleton className="mt-4 h-24 w-full max-w-5xl" />
      </div>
    );
  }

  if (status === 'error' || !game) {
    return (
       <div className="flex h-screen items-center justify-center">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao Carregar a Sala</CardTitle>
            <CardDescription>
              A sala não foi encontrada ou você não tem permissão para vê-la.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/cash-game">Voltar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Only admins can be croupiers, and only one at a time.
  const isCroupierOccupied = game.croupierId && game.croupierId !== user?.uid;
  if (!canManageGame) {
    return (
       <div className="flex h-screen items-center justify-center">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
             { 'Apenas administradores ou o dono da sala podem acessar o modo Croupier.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <Link href={`/cash-game/${gameId}`}>Voltar para Sala</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
    if (isCroupierOccupied) {
    return (
       <div className="flex h-screen items-center justify-center">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
             {'Outro administrador já está no modo Croupier. Apenas um por vez.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <Link href={`/cash-game/${gameId}`}>Voltar para Sala</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  // Ensure positions are set before allowing dealer mode
  if (!game.positionsSet) {
     return (
       <div className="flex h-screen items-center justify-center">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardTitle>Posições não Definidas</CardTitle>
            <CardDescription>
             Você precisa sortear as posições dos jogadores na página principal da sala antes de iniciar o modo Croupier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
                <Link href={`/cash-game/${gameId}`}>Voltar para Sala</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getPlayerInitialStack = (playerId: string) => {
      const player = game.players.find(p => p.id === playerId);
      if (!player) return 0;
      // This is a simplification and might not be accurate post-hand.
      // The handState.stack should be the source of truth during a hand.
      return player.transactions.reduce((acc, t) => acc + t.amount, 0);
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-black p-2 lg:p-4">
      <main className="flex h-full w-full flex-col">
        <div className="flex-grow">
          <PokerTable
            players={game.handState?.players || game.players.map(p => ({
                id: p.id,
                name: p.name,
                seat: p.seat!,
                stack: getPlayerInitialStack(p.id),
                bet: 0,
                hasActed: false,
                isFolded: false,
                isAllIn: false,
            }))}
            dealerId={game.dealerId}
            smallBlindPlayerId={game.handState?.smallBlindPlayerId}
            bigBlindPlayerId={game.handState?.bigBlindPlayerId}
            activePlayerId={game.handState?.activePlayerId}
            communityCards={game.handState?.communityCards}
            pots={game.handState?.pots}
            onSetDealer={(playerId) => canManageGame && updateGame({ dealerId: playerId })}
            showCommunityCardAnimation={showCommunityCardAnimation}
          />
        </div>
        <div className="w-full shrink-0">
          <DealerControls 
            game={game} 
            onUpdateHand={updateHandState}
            onUpdateGame={updateGame}
          />
        </div>
      </main>
    </div>
  );
}
