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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableFooter as UiTableFooter,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  PlusCircle,
  Trash2,
  Palette,
  Calculator,
  UserPlus,
  ArrowLeft,
  FileText,
  AlertCircle,
  CheckCircle2,
  LogOut,
  History,
  Shuffle,
  Copy,
  Lock,
  Check,
  X,
  Hourglass,
  ThumbsDown,
  LogIn,
  Wallet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { sortPlayersAndSetDealer } from '@/lib/poker-utils';
import PokerTable from './poker-table';
import CardDealAnimation from './card-deal-animation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDoc, arrayUnion } from 'firebase/firestore';
import { Skeleton } from './ui/skeleton';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const ChipIcon = ({ color, className }: { color: string; className?: string }) => (
  <div
    className={cn('h-5 w-5 rounded-full border-2 border-white/20 inline-block', className)}
    style={{ backgroundColor: color }}
  />
);

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
  
  const chips = game?.chips ?? [];
  const players = game?.players ?? [];
  const cashedOutPlayers = game?.cashedOutPlayers ?? [];
  const positionsSet = game?.positionsSet ?? false;
  const requests = game?.requests ?? [];

  const currentUserPlayerInfo = useMemo(() => {
    if (!user || !game) return null;
    return game.players.find(p => p.id === user.uid) || null;
  }, [user, game]);

  const currentUserIsPlayer = !!currentUserPlayerInfo;

  const currentUserStatus = useMemo(() => {
    if (currentUserIsPlayer) return 'player';
    if (!user || !game) return 'spectator';
    const userRequest = game.requests.find(r => r.userId === user.uid);
    if (userRequest) return userRequest.status; // 'pending' | 'approved' | 'declined'
    return 'spectator';
  }, [user, game, currentUserIsPlayer]);


  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerBuyIn, setNewPlayerBuyIn] = useState('');
  const [isAddChipOpen, setIsAddChipOpen] = useState(false);
  const [newChip, setNewChip] = useState({ name: '', value: '', color: '#ffffff' });
  const [rebuyAmount, setRebuyAmount] = useState('');
  const [playerForDetails, setPlayerForDetails] = useState<Player | null>(null);

  const [isDealing, setIsDealing] = useState(false);
  const [playersForAnimation, setPlayersForAnimation] = useState<Player[]>([]);

  const [isCashOutOpen, setIsCashOutOpen] = useState(false);
  const [playerToCashOut, setPlayerToCashOut] = useState<Player | null>(null);
  const [cashOutChipCounts, setCashOutChipCounts] = useState<Map<number, number>>(new Map());

  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState<{
    type: 'buy-in' | 'rebuy' | 'approve' | 'admin-join';
    amount: number;
    playerId?: string;
    playerName?: string;
    request?: JoinRequest;
  } | null>(null);
  const [manualChipCounts, setManualChipCounts] = useState<Map<number, number>>(new Map());

  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [croupierTipsChipCounts, setCroupierTipsChipCounts] = useState<Map<number, number>>(new Map());
  const [rakeChipCounts, setRakeChipCounts] = useState<Map<number, number>>(new Map());

  // State for approving a player
  const [approvingPlayer, setApprovingPlayer] = useState<JoinRequest | null>(null);
  const [approvalBuyIn, setApprovalBuyIn] = useState('');

  // State for admin joining
  const [adminBuyIn, setAdminBuyIn] = useState('');

  const [isClient, setIsClient] = useState(false);

  // States for "My Situation" dialog
  const [isMySituationOpen, setIsMySituationOpen] = useState(false);
  const [myChipCounts, setMyChipCounts] = useState<Map<number, number>>(new Map());


  useEffect(() => {
    setIsClient(true);
  }, []);

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
    // This is the list that the animation component will use to present the cards in order
    setPlayersForAnimation(playersWithDealtCards);
    // This is the final state with seats assigned, saved to Firestore
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

    setManualChipCounts(chipMap);
    setTransactionDetails({ type, ...details });
    setIsDistributionModalOpen(true);
  };

  const handleChipCountChange = (chipId: number, countStr: string) => {
    const count = parseInt(countStr) || 0;
    setManualChipCounts((prev) => new Map(prev).set(chipId, count));
  };

  const distributedValue = useMemo(() => {
    return Array.from(manualChipCounts.entries()).reduce((acc, [chipId, count]) => {
      const chip = sortedChips.find((c) => c.id === chipId);
      return acc + (chip ? chip.value * count : 0);
    }, 0);
  }, [manualChipCounts, sortedChips]);

  const confirmTransaction = async () => {
    if (!transactionDetails || !gameRef || !user) return;
  
    const { type, amount, playerId, playerName, request } = transactionDetails;
  
    const chipDistribution = sortedChips.map((chip) => ({
      chipId: chip.id,
      count: manualChipCounts.get(chip.id) || 0,
    }));
  
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

    let seat: number | undefined = undefined;
    if (currentGameData.positionsSet) {
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
        id: playerName!, // For manual players, ID is the name for simplicity before having a user system
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
      setNewPlayerName('');
      setNewPlayerBuyIn('');
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
          // Atomically update players and requests
          const updatedRequests = currentGameData.requests.map(r => r.userId === request!.userId ? { ...r, status: 'approved' as const } : r);
      
          updateGame({
              players: updatedPlayers,
              requests: updatedRequests
          });
          toast({ title: 'Jogador Aprovado!', description: `${pName} entrou na mesa com R$${amount.toFixed(2)}.` });
        } else { // admin-join
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
      setRebuyAmount('');
    }
  
    setIsDistributionModalOpen(false);
    setTransactionDetails(null);
    setApprovingPlayer(null);
    setApprovalBuyIn('');
    setAdminBuyIn('');
  };

  const handleApproveRequest = (req: JoinRequest) => {
    if (!approvalBuyIn) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Insira um valor de buy-in para aprovar o jogador.' });
      return;
    }
    const amount = parseFloat(approvalBuyIn);
    handleOpenDistributionModal('approve', {
      playerId: req.userId,
      playerName: req.userName,
      amount,
      request: req,
    });
  };

  const handleAdminJoin = () => {
    if (!adminBuyIn || !user) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Insira um valor de buy-in para entrar no jogo.' });
      return;
    }
    const amount = parseFloat(adminBuyIn);
    handleOpenDistributionModal('admin-join', {
      playerId: user.uid,
      playerName: user.nickname,
      amount,
    });
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

  const handleAddChip = () => {
    const value = parseFloat(newChip.value);
    if (!newChip.name || isNaN(value) || value <= 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, preencha nome e valor (positivo) da ficha.',
      });
      return;
    }
    const newChipData: Chip = {
      id: chips.length > 0 ? Math.max(...chips.map((c) => c.id)) + 1 : 1,
      name: newChip.name,
      value,
      color: newChip.color,
    };
    updateGame({ chips: [...chips, newChipData] });
    toast({ title: 'Ficha Adicionada!', description: `A ficha "${newChip.name}" foi adicionada.` });
    setNewChip({ name: '', value: '', color: '#ffffff' });
    setIsAddChipOpen(false);
  };

  const handleRemoveChip = (id: number) => {
    if (players.length > 0 || cashedOutPlayers.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Ação Bloqueada',
        description: 'Não é possível remover fichas com um jogo em andamento.',
      });
      return;
    }
    updateGame({ chips: chips.filter((c) => c.id !== id) });
  };

  const handleResetChips = () => {
    const initialChips: Chip[] = [
      { id: 1, value: 0.25, color: '#22c55e', name: 'Verde' },
      { id: 2, value: 0.5, color: '#ef4444', name: 'Vermelha' },
      { id: 3, value: 1, color: '#f5f5f5', name: 'Branca' },
      { id: 4, value: 10, color: '#171717', name: 'Preta' },
    ];
    if (players.length > 0 || cashedOutPlayers.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Ação Bloqueada',
        description: 'Não é possível resetar as fichas com um jogo em andamento.',
      });
      return;
    }
    updateGame({ chips: initialChips });
    toast({ title: 'Fichas Resetadas!', description: 'As fichas foram restauradas para o padrão.' });
  };

  const totalActivePlayerBuyIn = useMemo(() => {
    return players.reduce(
      (total, player) => total + player.transactions.reduce((subTotal, trans) => subTotal + trans.amount, 0),
      0
    );
  }, [players]);

  const getPlayerTotalChips = useCallback(
    (player: Player) => {
      const playerTotalChips = new Map<number, number>();
      player.transactions.forEach((trans) => {
        trans.chips.forEach((chip) => {
          playerTotalChips.set(chip.chipId, (playerTotalChips.get(chip.chipId) || 0) + chip.count);
        });
      });
      return sortedChips.map((chip) => ({ chipId: chip.id, count: playerTotalChips.get(chip.id) || 0 }));
    },
    [sortedChips]
  );

  const totalChipsOnTable = useMemo(() => {
    const totals = new Map<number, number>();
    players.forEach((player) => {
      const playerChips = getPlayerTotalChips(player);
      playerChips.forEach((chip) => {
        totals.set(chip.chipId, (totals.get(chip.chipId) || 0) + chip.count);
      });
    });
    return sortedChips.map((chip) => ({ chip, count: totals.get(chip.id) || 0 }));
  }, [players, sortedChips, getPlayerTotalChips]);

  const totalValueOnTableByChip = useMemo(() => {
    return totalChipsOnTable.map(({ chip, count }) => chip.value * count);
  }, [totalChipsOnTable]);

  const grandTotalValueOnTable = useMemo(() => {
    return totalValueOnTableByChip.reduce((acc, value) => acc + value, 0);
  }, [totalValueOnTableByChip]);

  const totalSessionBuyIn = useMemo(() => {
    const activePlayersBuyIn = players.reduce(
      (total, player) => total + player.transactions.reduce((subTotal, trans) => subTotal + trans.amount, 0),
      0
    );
    const cashedOutPlayersBuyIn = cashedOutPlayers.reduce((total, player) => total + player.totalInvested, 0);
    return activePlayersBuyIn + cashedOutPlayersBuyIn;
  }, [players, cashedOutPlayers]);

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

  const handleTipRakeChipCountChange = (type: 'tips' | 'rake', chipId: number, count: number) => {
    if (type === 'tips') {
      setCroupierTipsChipCounts((prev) => new Map(prev).set(chipId, count));
    } else {
      setRakeChipCounts((prev) => new Map(prev).set(chipId, count));
    }
  };

  const getPlayerSettlementData = useCallback(
    (player: Player) => {
      const totalInvested = player.transactions.reduce((acc, t) => acc + t.amount, 0);
      const finalChipCountsMap = new Map(Object.entries(player.finalChipCounts).map(([k, v]) => [parseInt(k), v]));
      const finalValue = Array.from(finalChipCountsMap.entries()).reduce((acc, [chipId, count]) => {
        const chip = sortedChips.find((c) => c.id === chipId);
        return acc + (chip ? chip.value * count : 0);
      }, 0);
      const balance = finalValue - totalInvested;
      return { totalInvested, finalValue, balance };
    },
    [sortedChips]
  );

  const croupierTipsValue = useMemo(() => {
    return Array.from(croupierTipsChipCounts.entries()).reduce((acc, [chipId, count]) => {
      const chip = sortedChips.find((c) => c.id === chipId);
      return acc + (chip ? chip.value * count : 0);
    }, 0);
  }, [croupierTipsChipCounts, sortedChips]);

  const rakeValue = useMemo(() => {
    return Array.from(rakeChipCounts.entries()).reduce((acc, [chipId, count]) => {
      const chip = sortedChips.find((c) => c.id === chipId);
      return acc + (chip ? chip.value * count : 0);
    }, 0);
  }, [rakeChipCounts, sortedChips]);

  const totalSettlementValue = useMemo(() => {
    const activePlayersValue = players.reduce((total, player) => {
      return total + getPlayerSettlementData(player).finalValue;
    }, 0);
    const cashedOutPlayersValue = cashedOutPlayers.reduce((total, player) => total + player.amountReceived, 0);
    return activePlayersValue + cashedOutPlayersValue;
  }, [players, cashedOutPlayers, getPlayerSettlementData]);

  const settlementDifference = useMemo(() => {
    return totalSettlementValue + croupierTipsValue + rakeValue - totalSessionBuyIn;
  }, [totalSettlementValue, totalSessionBuyIn, croupierTipsValue, rakeValue]);

  const settlementChipsInPlay = useMemo(() => {
    const totalDistributed = new Map<number, number>();
    [...players, ...cashedOutPlayers].forEach((p) => {
      p.transactions.forEach((t) => {
        t.chips.forEach((c) => {
          totalDistributed.set(c.chipId, (totalDistributed.get(c.chipId) || 0) + c.count);
        });
      });
    });

    const totalCashedOutChips = new Map<number, number>();
    cashedOutPlayers.forEach((p) => {
      const pChipCounts = new Map(Object.entries(p.chipCounts).map(([k, v]) => [parseInt(k), v]));
      pChipCounts.forEach((count, chipId) => {
        totalCashedOutChips.set(chipId, (totalCashedOutChips.get(chipId) || 0) + count);
      });
    });

    const remainingChips = new Map<number, number>();
    sortedChips.forEach((chip) => {
      const distributed = totalDistributed.get(chip.id) || 0;
      const cashedOut = totalCashedOutChips.get(chip.id) || 0;
      remainingChips.set(chip.id, distributed - cashedOut);
    });

    return sortedChips.map((chip) => ({ chip, count: remainingChips.get(chip.id) || 0 }));
  }, [players, cashedOutPlayers, sortedChips]);

  const handleOpenCashOut = (player: Player) => {
    setPlayerToCashOut(player);
    setCashOutChipCounts(new Map());
    setIsCashOutOpen(true);
  };

  const handleCashOutChipCountChange = (chipId: number, count: number) => {
    setCashOutChipCounts((prev) => new Map(prev).set(chipId, count));
  };

  const cashOutValue = useMemo(() => {
    return Array.from(cashOutChipCounts.entries()).reduce((acc, [chipId, count]) => {
      const chip = sortedChips.find((c) => c.id === chipId);
      return acc + (chip ? chip.value * count : 0);
    }, 0);
  }, [cashOutChipCounts, sortedChips]);

  const confirmCashOut = () => {
    if (!playerToCashOut) return;

    const totalInvested = playerToCashOut.transactions.reduce((acc, t) => acc + t.amount, 0);

    const newCashedOutPlayer: CashedOutPlayer = {
      id: playerToCashOut.id,
      name: playerToCashOut.name,
      transactions: playerToCashOut.transactions,
      cashedOutAt: new Date().toISOString(),
      amountReceived: cashOutValue,
      chipCounts: Object.fromEntries(cashOutChipCounts),
      totalInvested: totalInvested,
    };

    updateGame({
      cashedOutPlayers: [...cashedOutPlayers, newCashedOutPlayer],
      players: players.filter((p) => p.id !== playerToCashOut.id),
    });

    toast({
      title: 'Cash Out Realizado!',
      description: `${playerToCashOut.name} saiu da mesa com ${cashOutValue.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}.`,
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

  const isUserGameOwner = useMemo(() => game?.ownerId === user?.uid, [game, user]);
  const canManageGame = isAdmin || isUserGameOwner;

  const handleMyChipCountChange = (chipId: number, count: number) => {
    setMyChipCounts(prev => new Map(prev).set(chipId, count));
  };

  const myCurrentChipsValue = useMemo(() => {
    return Array.from(myChipCounts.entries()).reduce((acc, [chipId, count]) => {
      const chip = sortedChips.find(c => c.id === chipId);
      return acc + (chip ? chip.value * count : 0);
    }, 0);
  }, [myChipCounts, sortedChips]);
  
  const myTotalInvested = useMemo(() => {
    if (!currentUserPlayerInfo) return 0;
    return currentUserPlayerInfo.transactions.reduce((acc, t) => acc + t.amount, 0);
  }, [currentUserPlayerInfo]);
  
  const myBalance = useMemo(() => {
    return myCurrentChipsValue - myTotalInvested;
  }, [myCurrentChipsValue, myTotalInvested]);

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

  const copyGameId = () => {
    navigator.clipboard.writeText(gameId);
    toast({ title: 'ID da Sala Copiado!', description: 'Você pode compartilhar este ID com seus amigos.' });
  };
  
  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div className="min-h-screen w-full bg-background p-4 md:p-8">
      {isDealing && <CardDealAnimation players={playersForAnimation} onComplete={onDealingComplete} />}
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon" className="shrink-0">
              <Link href="/cash-game">
                <ArrowLeft />
              </Link>
            </Button>
            <div className="flex flex-col items-start gap-1">
              <h1 className="font-headline text-3xl font-bold text-accent md:text-4xl">{game?.name}</h1>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-muted-foreground break-all">ID: {gameId}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyGameId}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {currentUserIsPlayer && (
              <Dialog open={isMySituationOpen} onOpenChange={setIsMySituationOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary">
                    <Wallet className="mr-2 h-4 w-4" />
                    Minha Situação
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Minha Situação na Mesa</DialogTitle>
                    <DialogDescription>
                      Calcule seu balanço atual inserindo a quantidade de fichas que você tem.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-6">
                    <div>
                      <h3 className="font-semibold mb-2">Meu Investimento</h3>
                      <div className="space-y-1 text-sm">
                        {currentUserPlayerInfo?.transactions.map(t => (
                           <div key={t.id} className="flex justify-between items-center">
                              <span className="capitalize text-muted-foreground">{t.type} #{t.id}</span>
                              <span className="font-mono">{t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                           </div>
                        ))}
                         <Separator className="!my-2" />
                         <div className="flex justify-between items-center font-bold">
                            <span>Total Investido</span>
                            <span className="font-mono">{myTotalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                         </div>
                      </div>
                    </div>
                     <div>
                      <h3 className="font-semibold mb-2">Minhas Fichas Atuais</h3>
                       <div className="space-y-2">
                        {sortedChips.map((chip) => (
                          <div key={chip.id} className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor={`my-chip-${chip.id}`} className="text-right flex items-center justify-end gap-2 text-sm">
                              <ChipIcon color={chip.color} />
                              Fichas de {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </Label>
                            <Input
                              id={`my-chip-${chip.id}`}
                              type="number"
                              inputMode="decimal"
                              className="col-span-2"
                              min="0"
                              placeholder="Quantidade"
                              value={myChipCounts.get(chip.id) || ''}
                              onChange={(e) => handleMyChipCountChange(chip.id, parseInt(e.target.value) || 0)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                     <Separator className="!my-4" />
                     <div className="space-y-2 text-lg">
                        <div className="flex justify-between items-center font-bold">
                           <Label>Valor Atual em Fichas:</Label>
                           <span className="font-mono text-primary">{myCurrentChipsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="flex justify-between items-center font-bold">
                           <Label>Balanço (Lucro/Prejuízo):</Label>
                           <span className={cn('font-mono', myBalance >= 0 ? 'text-green-400' : 'text-red-400')}>
                            {myBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                     </div>
                  </div>
                   <DialogFooter>
                      <Button onClick={() => setIsMySituationOpen(false)}>Fechar</Button>
                   </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button variant="outline" onClick={handleLogout} size="sm" className="shrink-0">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        {currentUserStatus === 'pending' && (
          <Alert className="mb-8 border-amber-500 text-amber-500">
            <Hourglass className="h-4 w-4 !text-amber-500" />
            <AlertTitle>Aguardando Aprovação</AlertTitle>
            <AlertDescription>Sua solicitação para entrar na mesa está pendente. O administrador precisa aprová-la.</AlertDescription>
          </Alert>
        )}
        {currentUserStatus === 'declined' && (
          <Alert variant="destructive" className="mb-8">
            <ThumbsDown className="h-4 w-4" />
            <AlertTitle>Solicitação Recusada</AlertTitle>
            <AlertDescription>Sua solicitação para entrar na mesa foi recusada pelo administrador. Entre em contato com ele para mais informações.</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:hidden">
            <CardHeader>
              <CardTitle className="text-secondary-foreground">Banca Ativa</CardTitle>
              <CardDescription className="text-secondary-foreground/80">
                Valor total que entrou na mesa (jogadores ativos).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-accent">
                {totalActivePlayerBuyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </CardContent>
          </Card>

          <main className="lg:col-span-2 space-y-8">
            
            {isAdmin && !currentUserIsPlayer && (
               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <LogIn /> Entrar no Jogo
                  </CardTitle>
                  <CardDescription>Como administrador, você pode entrar diretamente na mesa.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full">Entrar no Jogo</Button>
                      </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Entrar na Mesa</DialogTitle>
                        <DialogDescription>
                          Insira o valor do seu buy-in para entrar no jogo.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Label htmlFor="admin-buy-in">Valor do Buy-in (R$)</Label>
                        <Input
                          id="admin-buy-in"
                          type="number"
                          inputMode="decimal"
                          placeholder="Ex: 50.00"
                          value={adminBuyIn}
                          onChange={(e) => setAdminBuyIn(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <DialogClose asChild>
                            <Button onClick={handleAdminJoin} disabled={!adminBuyIn}>
                                Confirmar e Distribuir Fichas
                            </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}

            {canManageGame && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus /> Adicionar Jogador Manualmente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4">
                    <Input
                      placeholder="Nome do Jogador"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="Valor do Buy-in (R$)"
                      value={newPlayerBuyIn}
                      onChange={(e) => setNewPlayerBuyIn(e.target.value)}
                    />
                    <Button
                      onClick={() => {
                        if (!newPlayerName || !newPlayerBuyIn) {
                          toast({
                            variant: 'destructive',
                            title: 'Erro',
                            description: 'Preencha o nome e o valor de buy-in.',
                          });
                          return;
                        }
                        handleOpenDistributionModal('buy-in', {
                          playerName: newPlayerName,
                          amount: parseFloat(newPlayerBuyIn),
                        });
                      }}
                      className="w-full md:w-auto"
                    >
                      <PlusCircle className="mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {canManageGame && pendingRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Lock /> Solicitações Pendentes
                  </CardTitle>
                  <CardDescription>Aprove ou recuse os jogadores que pediram para entrar na sala.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingRequests.map((req) => (
                    <div key={req.userId} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div>
                        <p className="font-semibold">{req.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {isClient ? `Pedido às ${new Date(req.requestedAt).toLocaleTimeString('pt-BR')}` : 'Carregando...'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                         <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => setApprovingPlayer(req)}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Aprovar
                              </Button>
                            </DialogTrigger>
                           <DialogContent className="max-w-md">
                             <DialogHeader>
                               <DialogTitle>Aprovar {req.userName}?</DialogTitle>
                               <DialogDescription>
                                 Insira o valor do buy-in para adicionar o jogador à mesa.
                               </DialogDescription>
                             </DialogHeader>
                             <div className="py-4">
                               <Label htmlFor="approval-buy-in">Valor do Buy-in (R$)</Label>
                               <Input
                                 id="approval-buy-in"
                                 type="number"
                                 inputMode="decimal"
                                 placeholder="Ex: 50.00"
                                 value={approvalBuyIn}
                                 onChange={(e) => setApprovalBuyIn(e.target.value)}
                               />
                             </div>
                             <DialogFooter>
                               <DialogClose asChild>
                                 <Button variant="outline">Cancelar</Button>
                               </DialogClose>
                               <Button onClick={() => handleApproveRequest(req)} disabled={!approvalBuyIn}>
                                 Confirmar e Distribuir Fichas
                               </Button>
                             </DialogFooter>
                           </DialogContent>
                         </Dialog>
                        <Button size="sm" variant="destructive" onClick={() => handleDeclineRequest(req)}>
                          <X className="h-4 w-4 mr-2" />
                          Recusar
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {positionsSet && (
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
            <Dialog
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  setPlayerForDetails(null);
                  setRebuyAmount('');
                }
              }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Jogadores na Mesa</CardTitle>
                    <CardDescription>Distribuição de fichas e ações para cada jogador ativo.</CardDescription>
                  </div>
                  {!positionsSet && players.length > 1 && canManageGame && (
                    <Button onClick={handleStartDealing} variant="secondary">
                      <Shuffle className="mr-2 h-4 w-4" />
                      Sortear Posições
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Jogador</TableHead>
                          <TableHead className="text-right">Buy-in Total</TableHead>
                          {sortedChips.map((chip) => (
                            <TableHead key={chip.id} className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <ChipIcon color={chip.color} />
                                <span className="whitespace-nowrap">
                                  {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                            </TableHead>
                          ))}
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {players.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4 + sortedChips.length}
                              className="text-center text-muted-foreground h-24"
                            >
                              Nenhum jogador na mesa ainda.
                            </TableCell>
                          </TableRow>
                        ) : (
                          players.map((player) => {
                            const playerTotalBuyIn = player.transactions.reduce((acc, t) => acc + t.amount, 0);
                            const playerTotalChips = getPlayerTotalChips(player);
                            return (
                              <TableRow key={player.id}>
                                <TableCell className="font-medium">{player.name}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {playerTotalBuyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </TableCell>
                                {playerTotalChips.map((chip) => (
                                  <TableCell key={chip.chipId} className="text-center font-mono">
                                    {chip.count}
                                  </TableCell>
                                ))}
                                <TableCell className="text-right flex items-center justify-end gap-1">
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setPlayerForDetails(player)}
                                      disabled={!canManageGame}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenCashOut(player)}
                                    disabled={!canManageGame}
                                  >
                                    <LogOut className="h-4 w-4" />
                                  </Button>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="icon" disabled={!canManageGame}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Remover {player.name}?</DialogTitle>
                                        <DialogDescription>
                                          Tem certeza que deseja remover este jogador? Todas as suas transações serão
                                          perdidas. Esta ação não é um cash out.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <DialogFooter>
                                        <DialogClose asChild>
                                          <Button variant="outline">Cancelar</Button>
                                        </DialogClose>
                                        <Button variant="destructive" onClick={() => removePlayer(player.id)}>
                                          Sim, Remover
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                      {players.length > 0 && (
                        <UiTableFooter>
                          <TableRow className="bg-muted/50 hover:bg-muted font-bold">
                            <TableCell colSpan={2} className="text-right">
                              Total de Fichas na Mesa
                            </TableCell>
                            {totalChipsOnTable.map(({ chip, count }) => (
                              <TableCell key={chip.id} className="text-center font-mono">
                                {count}
                              </TableCell>
                            ))}
                            <TableCell></TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/80 hover-bg-muted font-bold">
                            <TableCell colSpan={2} className="text-right">
                              Valor Total na Mesa
                            </TableCell>
                            {totalValueOnTableByChip.map((value, index) => (
                              <TableCell key={sortedChips[index].id} className="text-center font-mono">
                                {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-mono">
                              {grandTotalValueOnTable.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </TableCell>
                          </TableRow>
                        </UiTableFooter>
                      )}
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Detalhes de {playerForDetails?.name}</DialogTitle>
                  <DialogDescription>
                    Histórico de transações e contagem de fichas do jogador.
                  </DialogDescription>
                </DialogHeader>

                {playerForDetails && (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transação</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          {sortedChips.map((chip) => (
                            <TableHead key={chip.id} className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <ChipIcon color={chip.color} />
                                <span className="whitespace-nowrap">
                                  {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {playerForDetails.transactions.map((trans) => (
                          <TableRow key={trans.id}>
                            <TableCell className="font-medium capitalize">
                              {trans.type} #{trans.id}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {trans.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            {sortedChips.map((chip) => {
                              const tChip = trans.chips.find((c) => c.chipId === chip.id);
                              return (
                                <TableCell key={chip.id} className="text-center font-mono">
                                  {tChip?.count || 0}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                      <UiTableFooter>
                        <TableRow className="bg-muted/50 hover:bg-muted font-bold">
                          <TableCell colSpan={2} className="text-right">
                            Total de Fichas
                          </TableCell>
                          {getPlayerTotalChips(playerForDetails).map((chip) => (
                            <TableCell key={chip.chipId} className="text-center font-mono">
                              {chip.count}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow className="bg-muted/80 hover:bg-muted font-bold">
                          <TableCell colSpan={2} className="text-right">
                            Valor Total Investido
                          </TableCell>
                          <TableCell colSpan={sortedChips.length + 1} className="text-left font-mono">
                            {playerForDetails.transactions
                              .reduce((acc, t) => acc + t.amount, 0)
                              .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                        </TableRow>
                      </UiTableFooter>
                    </Table>

                    <Separator className="my-4" />

                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="rebuy-amount" className="text-right">
                          Adicionar Valor (R$)
                        </Label>
                        <Input
                          id="rebuy-amount"
                          type="number"
                          inputMode="decimal"
                          placeholder="Ex: 50"
                          value={rebuyAmount}
                          onChange={(e) => setRebuyAmount(e.target.value)}
                          className="col-span-3"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() =>
                          handleOpenDistributionModal('rebuy', {
                            playerId: playerForDetails.id,
                            playerName: playerForDetails.name,
                            amount: parseFloat(rebuyAmount),
                          })
                        }
                      >
                        Confirmar Adição
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
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
                                <ChipIcon color={chip.color} className="h-4 w-4" />
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
            <Card className="bg-secondary hidden lg:block">
              <CardHeader>
                <CardTitle className="text-secondary-foreground">Banca Ativa</CardTitle>
                <CardDescription className="text-secondary-foreground/80">
                  Valor total que entrou na mesa (jogadores ativos).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-accent">
                  {totalActivePlayerBuyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>

            {canManageGame && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette /> Fichas do Jogo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sortedChips.map((chip) => (
                        <div key={chip.id} className="flex items-center gap-2">
                          <ChipIcon color={chip.color} />
                          <Input
                            type="text"
                            value={chip.name}
                            onChange={(e) => {
                              const updatedChips = chips.map((c) =>
                                c.id === chip.id ? { ...c, name: e.target.value } : c
                              );
                              updateGame({ chips: updatedChips });
                            }}
                            className="w-24 flex-1"
                          />
                          <div className="flex items-center">
                            <span className="mr-2 text-sm">R$</span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={chip.value}
                              onChange={(e) => {
                                const updatedChips = chips.map((c) =>
                                  c.id === chip.id ? { ...c, value: parseFloat(e.target.value) || 0 } : c
                                );
                                updateGame({ chips: updatedChips });
                              }}
                              className="w-20"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveChip(chip.id)}
                            disabled={players.length > 0 || cashedOutPlayers.length > 0}
                          >
                            <Trash2 className="h-4 w-4 text-red-500/80" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Dialog open={isAddChipOpen} onOpenChange={setIsAddChipOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          Adicionar Ficha
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Adicionar Nova Ficha</DialogTitle>
                          <DialogDescription>Defina as propriedades da nova ficha para o jogo.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="chip-name" className="text-right">
                              Nome
                            </Label>
                            <Input
                              id="chip-name"
                              value={newChip.name}
                              onChange={(e) => setNewChip({ ...newChip, name: e.target.value })}
                              className="col-span-3"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="chip-value" className="text-right">
                              Valor (R$)
                            </Label>
                            <Input
                              id="chip-value"
                              type="number"
                              inputMode="decimal"
                              value={newChip.value}
                              onChange={(e) => setNewChip({ ...newChip, value: e.target.value })}
                              className="col-span-3"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="chip-color" className="text-right">
                              Cor
                            </Label>
                            <Input
                              id="chip-color"
                              type="color"
                              value={newChip.color}
                              onChange={(e) => setNewChip({ ...newChip, color: e.target.value })}
                              className="col-span-3 h-10 p-1"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddChip}>Salvar Ficha</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={handleResetChips}
                      disabled={players.length > 0 || cashedOutPlayers.length > 0}
                    >
                      Resetar Fichas
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator /> Acerto de Contas
                    </CardTitle>
                    <CardDescription>
                      Ao final do jogo, insira a contagem de fichas de cada jogador para calcular os resultados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground text-center">
                      Clique no botão abaixo para iniciar o acerto de contas.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Dialog open={isSettlementOpen} onOpenChange={setIsSettlementOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" disabled={!canManageGame || players.length === 0}>
                          Iniciar Acerto de Contas
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[90vw] md:max-w-4xl lg:max-w-6xl h-[90vh]">
                        <DialogHeader>
                          <DialogTitle>Acerto de Contas Final</DialogTitle>
                          <DialogDescription>
                            Insira a contagem final de fichas para cada jogador, gorjetas e rake. O sistema calculará os
                            valores.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="overflow-y-auto pr-4 -mr-4 h-full">
                          <div className="p-4 rounded-md bg-muted/50 border border-border mb-6">
                            <h3 className="text-lg font-bold text-foreground mb-2">
                              Total de Fichas em Jogo (Restantes)
                            </h3>
                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                              {settlementChipsInPlay.map(({ chip, count }) => (
                                <div key={chip.id} className="flex items-center gap-2">
                                  <ChipIcon color={chip.color} />
                                  <span className="font-bold">{chip.name}:</span>
                                  <span className="font-mono text-muted-foreground">{count} fichas</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <h3 className="text-xl font-bold mb-2">Jogadores</h3>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[150px]">Jogador</TableHead>
                                {sortedChips.map((chip) => (
                                  <TableHead key={chip.id} className="text-center w-[100px]">
                                    <div className="flex items-center justify-center gap-2">
                                      <ChipIcon color={chip.color} />
                                      <span>{chip.value.toFixed(2)}</span>
                                    </div>
                                  </TableHead>
                                ))}
                                <TableHead className="text-right">Investido (R$)</TableHead>
                                <TableHead className="text-right font-bold text-foreground">
                                  Valor Contado (R$)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {players.map((player) => {
                                const { totalInvested, finalValue } = getPlayerSettlementData(player);
                                const pFinalChips = new Map(
                                  Object.entries(player.finalChipCounts).map(([k, v]) => [parseInt(k), v])
                                );

                                return (
                                  <TableRow key={player.id}>
                                    <TableCell className="font-medium">{player.name}</TableCell>
                                    {sortedChips.map((chip) => (
                                      <TableCell key={chip.id}>
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          className="w-16 text-center font-mono mx-auto"
                                          min="0"
                                          value={pFinalChips.get(chip.id) || ''}
                                          onChange={(e) =>
                                            handlePlayerChipCountChange(
                                              player.id,
                                              chip.id,
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                        />
                                      </TableCell>
                                    ))}
                                    <TableCell className="text-right font-mono">
                                      {totalInvested.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-foreground">
                                      {finalValue.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>

                          <Separator className="my-6" />

                          <div className="grid md:grid-cols-2 gap-8">
                            <div>
                              <h3 className="text-xl font-bold mb-2">Gorjeta do Croupier</h3>
                              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                                {sortedChips.map((chip) => (
                                  <div key={`tips-${chip.id}`} className="grid grid-cols-2 items-center gap-2">
                                    <Label
                                      htmlFor={`tips-chip-${chip.id}`}
                                      className="text-sm flex items-center gap-2"
                                    >
                                      <ChipIcon color={chip.color} />
                                      Fichas de{' '}
                                      {chip.value.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </Label>
                                    <Input
                                      id={`tips-chip-${chip.id}`}
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      placeholder="Qtd."
                                      className="font-mono text-center"
                                      value={croupierTipsChipCounts.get(chip.id) || ''}
                                      onChange={(e) =>
                                        handleTipRakeChipCountChange('tips', chip.id, parseInt(e.target.value) || 0)
                                      }
                                    />
                                  </div>
                                ))}
                                <Separator className="my-2" />
                                <div className="flex justify-between items-center font-bold">
                                  <span>Total Gorjeta:</span>
                                  <span>
                                    {croupierTipsValue.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-xl font-bold mb-2">Rake da Casa</h3>
                              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                                {sortedChips.map((chip) => (
                                  <div key={`rake-${chip.id}`} className="grid grid-cols-2 items-center gap-2">
                                    <Label
                                      htmlFor={`rake-chip-${chip.id}`}
                                      className="text-sm flex items-center gap-2"
                                    >
                                      <ChipIcon color={chip.color} />
                                      Fichas de{' '}
                                      {chip.value.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </Label>
                                    <Input
                                      id={`rake-chip-${chip.id}`}
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      placeholder="Qtd."
                                      className="font-mono text-center"
                                      value={rakeChipCounts.get(chip.id) || ''}
                                      onChange={(e) =>
                                        handleTipRakeChipCountChange('rake', chip.id, parseInt(e.target.value) || 0)
                                      }
                                    />
                                  </div>
                                ))}
                                <Separator className="my-2" />
                                <div className="flex justify-between items-center font-bold">
                                  <span>Total Rake:</span>
                                  <span>
                                    {rakeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Separator className="my-6" />

                          {Math.abs(settlementDifference) < 0.01 ? (
                            <div className="p-4 rounded-md bg-green-900/50 border border-green-500">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="text-green-400" />
                                <h3 className="text-lg font-bold text-green-300">Contas Batem!</h3>
                              </div>
                              <p className="text-green-400/80 mt-1">
                                O valor total (fichas + gorjeta + rake) corresponde ao valor total que entrou na mesa.
                              </p>
                              <div className="mt-4">
                                <h4 className="font-bold mb-2 text-green-300">Pagamentos Finais:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                  <div>
                                    <p className="font-bold border-b pb-1 mb-2">Valor a Receber</p>
                                    <ul className="space-y-1 list-disc list-inside">
                                      {players.map((player) => {
                                        const { finalValue } = getPlayerSettlementData(player);
                                        return (
                                          <li key={player.id}>
                                            {player.name} recebe{' '}
                                            <span className="font-bold text-green-400">
                                              {finalValue.toLocaleString('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                              })}
                                            </span>
                                            .
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="font-bold border-b pb-1 mb-2">Lucro / Prejuízo</p>
                                    <ul className="space-y-1 list-disc list-inside">
                                      {players.map((player) => {
                                        const { balance } = getPlayerSettlementData(player);
                                        return (
                                          <li key={player.id}>
                                            {player.name}:{' '}
                                            <span
                                              className={cn(
                                                'font-bold',
                                                balance >= 0 ? 'text-green-400' : 'text-red-400'
                                              )}
                                            >
                                              {balance.toLocaleString('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                              })}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 rounded-md bg-red-900/50 border border-red-500">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="text-red-400" />
                                <h3 className="text-lg font-bold text-red-300">Erro na Contagem!</h3>
                              </div>
                              <p className="text-red-400/80 mt-1">
                                A soma das fichas, gorjeta e rake não corresponde ao total de buy-ins. Verifique a contagem
                                de fichas de cada jogador.
                              </p>
                            </div>
                          )}
                        </div>
                        <DialogFooter className="mt-4 gap-2 sm:gap-0">
                          <div className="flex-1 text-center md:text-right font-mono bg-muted p-2 rounded-md text-xs">
                            TOTAL ENTRADO:{' '}
                            <span className="font-bold">
                              {totalSessionBuyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <br />
                            TOTAL CONTADO:{' '}
                            <span className="font-bold">
                              {totalSettlementValue.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>{' '}
                            (+
                            {croupierTipsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{' '}
                            Gorjeta) (+
                            {rakeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} Rake)
                            <br />
                            Diferença:{' '}
                            <span
                              className={cn(
                                'font-bold',
                                Math.abs(settlementDifference) >= 0.01 ? 'text-destructive' : 'text-green-400'
                              )}
                            >
                              {settlementDifference.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="destructive">Resetar e Finalizar Sessão</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Confirmar Finalização</DialogTitle>
                                <DialogDescription>
                                  Tem certeza que deseja finalizar a sessão? A sala e todos os seus dados serão apagados
                                  permanentemente. Esta ação não pode ser desfeita.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Cancelar</Button>
                                </DialogClose>
                                <Button variant="destructive" onClick={resetGame}>
                                  Sim, Finalizar
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardFooter>
                </Card>
              </>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={isCashOutOpen} onOpenChange={setIsCashOutOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Cash Out de {playerToCashOut?.name}</DialogTitle>
            <DialogDescription>
              Insira a contagem final de fichas do jogador para calcular o valor a receber.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {sortedChips.map((chip) => (
              <div key={chip.id} className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor={`cashout-chip-${chip.id}`} className="text-right flex items-center justify-end gap-2">
                  <ChipIcon color={chip.color} />
                  Fichas de {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Label>
                <Input
                  id={`cashout-chip-${chip.id}`}
                  type="number"
                  inputMode="decimal"
                  className="col-span-2"
                  min="0"
                  placeholder="Quantidade"
                  value={cashOutChipCounts.get(chip.id) || ''}
                  onChange={(e) => handleCashOutChipCountChange(chip.id, parseInt(e.target.value) || 0)}
                />
              </div>
            ))}
            <Separator />
            <div className="flex justify-between items-center text-lg font-bold">
              <Label>Valor a Receber:</Label>
              <span className="text-primary">
                {cashOutValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCashOutOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmCashOut}>Confirmar Cash Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDistributionModalOpen} onOpenChange={setIsDistributionModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirmar Distribuição de Fichas</DialogTitle>
            <DialogDescription>
              Para {transactionDetails?.playerName} - Valor da Transação:{' '}
              {transactionDetails?.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {sortedChips.map((chip) => (
              <div key={chip.id} className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor={`dist-chip-${chip.id}`} className="text-right flex items-center justify-end gap-2">
                  <ChipIcon color={chip.color} />
                  Fichas de {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Label>
                <Input
                  id={`dist-chip-${chip.id}`}
                  type="number"
                  inputMode="decimal"
                  className="col-span-2"
                  min="0"
                  placeholder="Quantidade"
                  value={manualChipCounts.get(chip.id) || ''}
                  onChange={(e) => handleChipCountChange(chip.id, e.target.value)}
                />
              </div>
            ))}
            <Separator />
            <div className="flex justify-between items-center text-lg font-bold">
              <Label>Valor Distribuído:</Label>
              <span
                className={cn(
                  'font-mono',
                  Math.abs(distributedValue - (transactionDetails?.amount || 0)) > 0.01
                    ? 'text-destructive'
                    : 'text-primary'
                )}
              >
                {distributedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDistributionModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmTransaction}
              disabled={Math.abs(distributedValue - (transactionDetails?.amount || 0)) > 0.01}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashGameManager;

    