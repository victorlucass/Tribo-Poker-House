'use client';

import React, { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CashGame, HandState } from '@/lib/types';
import PokerTable from '@/components/poker-table';
import DealerControls from '@/components/cash-game/dealer-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DealerPage() {
  const params = useParams();
  const gameId = params.id as string;
  const router = useRouter();

  const firestore = useFirestore();

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'cashGames', gameId);
  }, [firestore, gameId]);

  const { data: game, status } = useDoc<CashGame>(gameRef);

  const updateHandState = useCallback(
    (handState: Partial<HandState> | null) => {
      if (!gameRef) return;
      // Use null to delete the field
      const dataToUpdate = handState === null ? { handState: null } : { handState };
      updateDocumentNonBlocking(gameRef, dataToUpdate);
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


  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-black p-2 lg:p-4">
      <main className="flex h-full w-full flex-col">
        <div className="flex-grow">
          <PokerTable
            players={game.handState?.players || game.players.map(p => ({
                id: p.id,
                name: p.name,
                seat: p.seat!,
                stack: p.transactions.reduce((acc, t) => acc + t.amount, 0),
                bet: 0,
                hasActed: false,
                isFolded: false,
                isAllIn: false,
            }))}
            dealerId={game.dealerId}
            activePlayerId={game.handState?.activePlayerId}
            communityCards={game.handState?.communityCards}
            pot={game.handState?.pot}
            smallBlindPlayerId={game.handState?.smallBlindPlayerId}
            bigBlindPlayerId={game.handState?.bigBlindPlayerId}
            onSetDealer={(playerId) => updateGame({ dealerId: playerId })}
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
