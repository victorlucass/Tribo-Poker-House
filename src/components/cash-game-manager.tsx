'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type {
  CashGame,
  CashGameChip as Chip,
  CashGamePlayer as Player,
  CashedOutPlayer,
  PlayerTransaction,
  JoinRequest,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { History, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { sortPlayersAndSetDealer } from '@/lib/poker-utils';
import PokerTable from './poker-table';
import CardDealAnimation from './card-deal-animation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc, arrayUnion } from 'firebase/firestore';
import { Skeleton } from './ui/skeleton';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

// New smaller components
import CashGameHeader from './cash-game/header';
import PlayerList from './cash-game/player-list';
import PlayerActions from './cash-game/player-actions';
import GameControls from './cash-game/game-controls';
import SpectatorView from './cash-game/spectator-view';
import {
  MySituationDialog,
  CashOutDialog,
  ChipDistributionDialog,
  PlayerDetailsDialog,
  SettlementDialog,
} from './cash-game/dialogs';

const distributeChips = (buyIn: number, availableChips: Chip[]): { chipId: number; count: number }[] => {
  let remainingAmount = buyIn;

  const chipsToUse =
    buyIn > 50
      ? availableChips.filter((c) => c.value === 1 || c.value === 10)
      : buyIn <= 30
      ? availableChips.filter((c) => c.value < 10)
      : availableChips;

  const sortedChips = [...chipsToUse].sort((a, b) => b.value - a.value);

  if (sortedChips.length === 0) {
    return [];
  }

  const distribution: Map<number, number> = new Map(sortedChips.map((c) => [c.id, 0]));

  const smallChipsFirst = [...sortedChips].sort((a, b) => a.value - b.value).filter((c) => c.value < 1);
  for (const chip of smallChipsFirst) {
    const idealCount = Math.min(Math.floor((buyIn * 0.1) / chip.value), 4);
    if (remainingAmount >= chip.value * idealCount) {
      distribution.set(chip.id, (distribution.get(chip.id) || 0) + idealCount);
      remainingAmount = parseFloat((remainingAmount - chip.value * idealCount).toFixed(2));
    }
  }

  for (const chip of sortedChips) {
    if (remainingAmount <= 0) break;
    if (chip.value > remainingAmount) continue;

    let allocationPercentage = 0;
    if (chip.value >= 10) allocationPercentage = 0.5;
    else if (chip.value >= 1) allocationPercentage = 0.4;
    else allocationPercentage = 0.3;

    let targetValueForChip = remainingAmount * allocationPercentage;

    let count = Math.floor(targetValueForChip / chip.value);

    if (chip.value < 1 && count > 5) {
      count = Math.round(count / 5) * 5;
    }

    if (count > 0) {
      const amountToDistribute = count * chip.value;
      if (remainingAmount >= amountToDistribute) {
        distribution.set(chip.id, (distribution.get(chip.id) || 0) + count);
        remainingAmount = parseFloat((remainingAmount - amountToDistribute).toFixed(2));
      }
    }
  }

  for (const chip of sortedChips) {
    if (remainingAmount < chip.value) continue;
    const count = Math.floor(remainingAmount / chip.value);
    if (count > 0) {
      distribution.set(chip.id, (distribution.get(chip.id) || 0) + count);
      remainingAmount = parseFloat((remainingAmount - count * chip.value).toFixed(2));
    }
  }

  if (remainingAmount > 0.01) {
    const smallestChips = [...sortedChips].sort((a, b) => a.value - b.value);
    for (const chip of smallestChips) {
      if (remainingAmount < chip.value) continue;
      const count = Math.ceil(remainingAmount / chip.value);
      if (count > 0) {
        distribution.set(chip.id, (distribution.get(chip.id) || 0) + count);
        remainingAmount = parseFloat((remainingAmount - count * chip.value).toFixed(2));
      }
    }
  }

  const finalDistribution = Array.from(distribution.entries()).map(([chipId, count]) => ({ chipId, count }));
  const totalDistributedValue = finalDistribution.reduce((acc, dist) => {
    const chip = availableChips.find((c) => c.id === dist.chipId);
    return acc + (chip ? chip.value * dist.count : 0);
  }, 0);

  if (Math.abs(totalDistributedValue - buyIn) > 0.01) {
    console.warn('Complex distribution failed. Falling back to greedy.', { totalDistributedValue, buyIn });
    const greedyDistribution: { chipId: number; count: number }[] = [];
    let greedyAmount = buyIn;
    for (const chip of sortedChips) {
      if (greedyAmount >= chip.value) {
        const count = Math.floor(greedyAmount / chip.value);
        greedyDistribution.push({ chipId: chip.id, count });
        greedyAmount = parseFloat((greedyAmount - count * chip.value).toFixed(2));
      }
    }
    if (Math.abs(greedyAmount) > 0.01) return [];
    return greedyDistribution;
  }

  return availableChips
    .map((chip) => ({
      chipId: chip.id,
      count: distribution.get(chip.id) || 0,
    }))
    .sort((a, b) => a.chipId - b.chipId);
};

interface CashGameManagerProps {
  gameId: string;
}

const CashGameManager: React.FC<CashGameManagerProps> = ({ gameId }) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isAdmin, handleLogout, loading: isAuthLoading } = useAuth();

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'cashGames', gameId);
  }, [firestore, gameId]);

  const { data: game, status, error } = useDoc<CashGame>(gameRef);

  const updateGame = useCallback(
    (data: Partial<CashGame>) => {
      if (!gameRef) return;
      updateDocumentNonBlocking(gameRef, data);
    },
    [gameRef]
  );

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const chips = game?.chips ?? [];
  const players = game?.players ?? [];
  const cashedOutPlayers = game?.cashedOutPlayers ?? [];
  const requests = game?.requests ?? [];

  const currentUserPlayerInfo = useMemo(() => {
    if (!user || !game) return null;
    return game.players.find(p => p.id === user.uid) || null;
  }, [user, game]);

  const currentUserIsPlayer = !!currentUserPlayerInfo;
  const isUserGameOwner = useMemo(() => game?.ownerId === user?.uid, [game, user]);
  const canManageGame = isAdmin || isUserGameOwner;

  const currentUserStatus = useMemo(() => {
    if (currentUserIsPlayer) return 'player';
    if (!user || !game) return 'spectator';
    const userRequest = game.requests.find(r => r.userId === user.uid);
    if (userRequest) return userRequest.status;
    return 'spectator';
  }, [user, game, currentUserIsPlayer]);

  const [isDealing, setIsDealing] = useState(false);
  const [playersForAnimation, setPlayersForAnimation] = useState<Player[]>([]);
  const [playerForDetails, setPlayerForDetails] = useState<Player | null>(null);
  const [playerToCashOut, setPlayerToCashOut] = useState<Player | null>(null);
  
  const [isMySituationOpen, setIsMySituationOpen] = useState(false);
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [isCashOutOpen, setIsCashOutOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

  const [transactionDetails, setTransactionDetails] = useState<{
    type: 'buy-in' | 'rebuy' | 'approve' | 'admin-join';
    amount: number;
    playerId?: string;
    playerName?: string;
    request?: JoinRequest;
  } | null>(null);
  
  const sortedChips = useMemo(() => [...chips].sort((a, b) => a.value - b.value), [chips]);

  const handleStartDealing = () => {
    if (players.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Jogadores Insuficientes',
        description: 'Precisa de pelo menos 2 jogadores para sortear as posições.',
      });
      return;
    }
    const { playersWithDealtCards, sortedPlayers, dealer } = sortPlayersAndSetDealer(players);
    setPlayersForAnimation(playersWithDealtCards);
    updateGame({
      players: sortedPlayers,
      dealerId: dealer.id,
    });
    setIsDealing(true);
  };

  const onDealingComplete = () => {
    setIsDealing(false);
    updateGame({ positionsSet: true });
    const dealer = players.find((p) => p.id === game?.dealerId);
    toast({ title: 'Posições Definidas!', description: `O dealer é ${dealer?.name}.` });
  };
  
  const handleOpenDistributionModal = (
    type: 'buy-in' | 'rebuy' | 'approve' | 'admin-join',
    details: { playerId?: string; playerName?: string; amount: number; request?: JoinRequest }
  ) => {
    const { amount } = details;

    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Valor Inválido', description: 'O valor deve ser um número positivo.' });
      return;
    }

    const suggestedDistribution = distributeChips(amount, chips);
    if (suggestedDistribution.length === 0) {
      toast({ variant: 'destructive', title: 'Erro na Distribuição', description: `Não foi possível distribuir R$${amount.toFixed(2)}.` });
      return;
    }

    const chipMap = new Map<number, number>();
    suggestedDistribution.forEach((c) => chipMap.set(c.chipId, c.count));

    setTransactionDetails({ type, ...details, chipMap });
    setIsDistributionModalOpen(true);
  };

  const confirmTransaction = async (chipDistribution: { chipId: number; count: number }[], distributedValue: number) => {
    if (!transactionDetails || !gameRef || !user) return;
  
    const { type, amount, playerId, playerName, request } = transactionDetails;
  
    if (Math.abs(distributedValue - amount) > 0.01) {
      toast({
        variant: 'destructive',
        title: 'Valores não batem',
        description: 'O valor distribuído nas fichas não corresponde ao valor da transação.',
      });
      return;
    }
  
    const gameDoc = await getDoc(gameRef);
    if (!gameDoc.exists()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'A sala não existe mais.' });
      return;
    }
    const currentGameData = gameDoc.data() as CashGame;
    const positionsSet = currentGameData.positionsSet;

    let seat: number | undefined = undefined;
    if (positionsSet) {
        const occupiedSeats = new Set(currentGameData.players.map((p) => p.seat));
        for (let i = 1; i <= 10; i++) {
            if (!occupiedSeats.has(i)) {
                seat = i;
                break;
            }
        }
        if (seat === undefined) {
            toast({ variant: 'destructive', title: 'Mesa Cheia', description: 'Não há assentos disponíveis.' });
            return;
        }
    }
  
    if (type === 'buy-in') {
      const newPlayer: Player = {
        id: playerName!,
        name: playerName!,
        transactions: [{ id: 1, type: 'buy-in', amount: amount, chips: chipDistribution }],
        finalChipCounts: {},
        seat: null,
        card: null,
      };
      let updatedPlayers = [...currentGameData.players, newPlayer];
      if (positionsSet) {
        updatedPlayers.sort((a, b) => (a.seat || 99) - (b.seat || 99));
      }
      updateGame({ players: updatedPlayers });
      toast({ title: 'Jogador Adicionado!', description: `${playerName} entrou na mesa com R$${amount.toFixed(2)}.` });
    } else if ((type === 'approve' && request) || type === 'admin-join') {
        const pId = type === 'admin-join' ? user.uid : request!.userId;
        const pName = type === 'admin-join' ? user.nickname : request!.userName;

        const newPlayer: Player = {
            id: pId,
            name: pName,
            transactions: [{ id: 1, type: 'buy-in', amount: amount, chips: chipDistribution }],
            finalChipCounts: {},
            seat: seat ?? null,
            card: null,
        };
        
        let updatedPlayers = [...currentGameData.players, newPlayer];
        if (positionsSet) {
            updatedPlayers.sort((a, b) => (a.seat || 99) - (b.seat || 99));
        }

        if (type === 'approve') {
          const updatedRequests = currentGameData.requests.map(r => r.userId === request!.userId ? { ...r, status: 'approved' as const } : r);
      
          updateGame({
              players: updatedPlayers,
              requests: updatedRequests
          });
          toast({ title: 'Jogador Aprovado!', description: `${pName} entrou na mesa com R$${amount.toFixed(2)}.` });
        } else {
          updateGame({ players: updatedPlayers });
          toast({ title: 'Você entrou no jogo!', description: `Você entrou na mesa com R$${amount.toFixed(2)}.` });
        }
    } else if (type === 'rebuy' && playerId) {
      const playerIndex = currentGameData.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return;
  
      const player = currentGameData.players[playerIndex];
      const newTransaction: PlayerTransaction = {
        id: (player.transactions.length > 0 ? Math.max(...player.transactions.map((t) => t.id)) : 0) + 1,
        type: 'rebuy',
        amount,
        chips: chipDistribution,
      };
  
      const updatedPlayer = { ...player, transactions: [...player.transactions, newTransaction] };
      const updatedPlayers = [...currentGameData.players];
      updatedPlayers[playerIndex] = updatedPlayer;
  
      updateGame({ players: updatedPlayers });
      setPlayerForDetails(updatedPlayer);
      toast({ title: 'Transação Concluída!', description: `R$${amount.toFixed(2)} adicionado para ${playerName}.` });
    }
  
    setIsDistributionModalOpen(false);
    setTransactionDetails(null);
  };
  
  const handleDeclineRequest = (request: JoinRequest) => {
    if (!game) return;
    const updatedRequests = game.requests.map(r => 
        r.userId === request.userId ? { ...r, status: 'declined' as const } : r
    );
    updateGame({ requests: updatedRequests });
    toast({ title: 'Solicitação Recusada', description: `O pedido de ${request.userName} foi recusado.` });
  };
  
  const removePlayer = (id: string) => {
    updateGame({
      players: players.filter((p) => p.id !== id),
    });
  };

  const confirmCashOut = (chipCounts: Map<number, number>, cashOutValue: number) => {
    if (!playerToCashOut) return;

    const totalInvested = playerToCashOut.transactions.reduce((acc, t) => acc + t.amount, 0);

    const newCashedOutPlayer: CashedOutPlayer = {
      id: playerToCashOut.id,
      name: playerToCashOut.name,
      transactions: playerToCashOut.transactions,
      cashedOutAt: new Date().toISOString(),
      amountReceived: cashOutValue,
      chipCounts: Object.fromEntries(chipCounts),
      totalInvested: totalInvested,
    };

    updateGame({
      cashedOutPlayers: [...cashedOutPlayers, newCashedOutPlayer],
      players: players.filter((p) => p.id !== playerToCashOut.id),
    });

    toast({
      title: 'Cash Out Realizado!',
      description: `${playerToCashOut.name} saiu da mesa com ${cashOutValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    });

    setIsCashOutOpen(false);
    setPlayerToCashOut(null);
  };

  const resetGame = () => {
    if (gameRef) {
      deleteDocumentNonBlocking(gameRef);
      toast({ title: 'Sessão Finalizada!', description: 'A sala foi apagada e está pronta para ser recriada.' });
      router.push('/cash-game');
    }
  };

  const handlePlayerChipCountChange = (playerId: string, chipId: number, count: number) => {
    const updatedPlayers = players.map((p) => {
      if (p.id === playerId) {
        const newCounts = new Map(Object.entries(p.finalChipCounts).map(([k, v]) => [parseInt(k), v]));
        newCounts.set(chipId, count);
        const finalChipCountsObj = Object.fromEntries(newCounts);
        return { ...p, finalChipCounts: finalChipCountsObj };
      }
      return p;
    });
    updateGame({ players: updatedPlayers });
  };


  // Loading and Error states
  if (status === 'loading' || isAuthLoading || !firestore) {
    return (
      <div className="min-h-screen w-full bg-background p-4 md:p-8">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <Skeleton className="h-16 w-1/2" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-8">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' || (status === 'success' && !game)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao Carregar a Sala</CardTitle>
            <CardDescription>
              {status === 'error'
                ? 'Não foi possível conectar ao banco de dados. Verifique sua conexão e as regras de segurança do Firestore.'
                : 'A sala que você está tentando acessar não foi encontrada. Verifique o ID e tente novamente.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <pre className="bg-muted p-2 rounded-md text-xs text-left">{error?.message}</pre>}
            <Button asChild>
              <Link href="/cash-game">Voltar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background p-4 md:p-8">
      {isDealing && <CardDealAnimation players={playersForAnimation} onComplete={onDealingComplete} />}

      <div className="mx-auto w-full max-w-7xl">
        <CashGameHeader
          gameName={game?.name}
          gameId={gameId}
          isClient={isClient}
          currentUserIsPlayer={currentUserIsPlayer}
          onMySituationClick={() => setIsMySituationOpen(true)}
          onLogoutClick={handleLogout}
        />
        
        <SpectatorView currentUserStatus={currentUserStatus} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <main className="lg:col-span-2 space-y-8">
            <PlayerActions
              canManageGame={canManageGame}
              currentUserIsPlayer={currentUserIsPlayer}
              isAdmin={isAdmin}
              onOpenDistributionModal={handleOpenDistributionModal}
              requests={requests}
              isClient={isClient}
              onDeclineRequest={handleDeclineRequest}
              onApproveRequest={(req, buyIn) => handleOpenDistributionModal('approve', { playerId: req.userId, playerName: req.userName, amount: parseFloat(buyIn), request: req })}
              onAdminJoin={(buyIn) => user && handleOpenDistributionModal('admin-join', { playerId: user.uid, playerName: user.nickname, amount: parseFloat(buyIn)})}
            />

            {game.positionsSet && (
              <Card>
                <CardHeader>
                  <CardTitle>Mesa de Jogo</CardTitle>
                </CardHeader>
                <CardContent>
                  <PokerTable players={players} dealerId={game?.dealerId ?? null} />
                </CardContent>
              </Card>
            )}

            {(currentUserStatus === 'player' || currentUserStatus === 'spectator' || canManageGame) && (
              <PlayerList 
                players={players}
                sortedChips={sortedChips}
                canManageGame={canManageGame}
                positionsSet={game.positionsSet}
                onStartDealing={handleStartDealing}
                onPlayerDetailsClick={setPlayerForDetails}
                onCashOutClick={(player) => { setPlayerToCashOut(player); setIsCashOutOpen(true); }}
                onRemovePlayer={removePlayer}
              />
            )}
            
            {cashedOutPlayers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History /> Histórico de Cash Outs
                  </CardTitle>
                  <CardDescription>Jogadores que já saíram da mesa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cashedOutPlayers.map((p) => {
                    const balance = p.amountReceived - p.totalInvested;
                    const pChipCounts = new Map(Object.entries(p.chipCounts).map(([k, v]) => [parseInt(k), v]));
                    return (
                      <div key={p.id} className="p-4 rounded-md border bg-muted/30">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold">{p.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Saiu às {isClient ? new Date(p.cashedOutAt).toLocaleTimeString('pt-BR') : '...'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-primary">
                              {p.amountReceived.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className={cn('text-sm font-bold', balance >= 0 ? 'text-green-400' : 'text-red-400')}>
                              Balanço: {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {sortedChips.map((chip) => {
                            const count = pChipCounts.get(chip.id) || 0;
                            if (count === 0) return null;
                            return (
                              <div key={chip.id} className="flex items-center gap-1.5">
                                <div className={cn('h-4 w-4 rounded-full border-2 border-white/20 inline-block')} style={{ backgroundColor: chip.color }}/>
                                <span className="font-mono">{count}x</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </main>

          <aside className="space-y-8 lg:col-start-3">
             <GameControls
              players={players}
              cashedOutPlayers={cashedOutPlayers}
              chips={chips}
              canManageGame={canManageGame}
              onUpdateChips={(updatedChips) => updateGame({ chips: updatedChips })}
              onSettlementClick={() => setIsSettlementOpen(true)}
             />
          </aside>
        </div>
      </div>
      
      {/* Dialogs */}
      {currentUserPlayerInfo && (
        <MySituationDialog 
            isOpen={isMySituationOpen}
            onOpenChange={setIsMySituationOpen}
            player={currentUserPlayerInfo}
            sortedChips={sortedChips}
        />
      )}

      {playerToCashOut && (
        <CashOutDialog
            isOpen={isCashOutOpen}
            onOpenChange={setIsCashOutOpen}
            player={playerToCashOut}
            sortedChips={sortedChips}
            onConfirm={confirmCashOut}
        />
      )}
      
      {transactionDetails && (
          <ChipDistributionDialog
            isOpen={isDistributionModalOpen}
            onOpenChange={setIsDistributionModalOpen}
            transactionDetails={transactionDetails}
            sortedChips={sortedChips}
            onConfirm={confirmTransaction}
            distributeChips={distributeChips}
          />
      )}
      
      {playerForDetails && (
          <PlayerDetailsDialog
            player={playerForDetails}
            sortedChips={sortedChips}
            onOpenChange={(isOpen) => !isOpen && setPlayerForDetails(null)}
            onRebuy={(amount) => handleOpenDistributionModal('rebuy', { playerId: playerForDetails.id, playerName: playerForDetails.name, amount })}
          />
      )}

      <SettlementDialog
        isOpen={isSettlementOpen}
        onOpenChange={setIsSettlementOpen}
        players={players}
        cashedOutPlayers={cashedOutPlayers}
        sortedChips={sortedChips}
        onPlayerChipCountChange={handlePlayerChipCountChange}
        onResetGame={resetGame}
      />
    </div>
  );
};

export default CashGameManager;
