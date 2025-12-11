'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hand, Play, FastForward, Check, X, CircleDollarSign, Flame } from 'lucide-react';
import type { CashGame, HandState, PlayerHandState, GamePhase } from '@/lib/types';
import { startNewHand, getNextPlayer, checkEndOfBettingRound, advanceHandPhase, collectBets, awardPotToWinner } from '@/lib/poker-utils';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface DealerControlsProps {
  game: CashGame;
  onUpdateHand: (handState: Partial<HandState> | null) => void;
  onUpdateGame: (gameData: Partial<CashGame>) => void;
}

const DealerControls: React.FC<DealerControlsProps> = ({ game, onUpdateHand, onUpdateGame }) => {
  const { handState, players, dealerId } = game;
  const activePlayer = handState?.players.find(p => p.id === handState?.activePlayerId);
  const { toast } = useToast();

  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [betAmount, setBetAmount] = useState<string>('');
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);

  
  const canManuallyAdvance = useMemo(() => {
    if (!handState) return false;
    return checkEndOfBettingRound(handState);
  }, [handState]);

  const handleStartNewHand = () => {
    if (!dealerId || players.length < 2) {
      toast({ variant: 'destructive', title: 'Erro', description: 'É preciso ter um dealer definido e pelo menos 2 jogadores para iniciar.'})
      return;
    }
    const { handState: newHand, nextDealerId } = startNewHand(players, dealerId, 1, 2); 
    onUpdateHand(newHand);
    onUpdateGame({ dealerId: nextDealerId });
  };
  
  const handleEndHandWithWinner = () => {
    if(!handState || !selectedWinnerId) return;
    
    const finalHandStateForAward = collectBets(handState);

    const updatedPlayers = awardPotToWinner(finalHandStateForAward, game.players, selectedWinnerId);

    onUpdateGame({ players: updatedPlayers });
    onUpdateHand(null); // Clear the table for the next hand
    setIsWinnerModalOpen(false);
    setSelectedWinnerId(null);
  };

  const handleAdvancePhase = (currentState: HandState) => {
    const betsCollectedState = collectBets(currentState);
    const nextPhaseState = advanceHandPhase(betsCollectedState, game.dealerId!);
    onUpdateHand(nextPhaseState);
  };
  
  const processEndOfRound = (updatedHandState: HandState) => {
     // Scenario 1: Only one player left who hasn't folded
    const activePlayers = updatedHandState.players.filter(p => !p.isFolded);
    if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        const finalState = collectBets(updatedHandState);
        const updatedGamePlayers = awardPotToWinner(finalState, game.players, winner.id);
        toast({ title: "Fim da Mão!", description: `${winner.name} venceu o pote pois todos desistiram.`});
        onUpdateGame({ players: updatedGamePlayers });
        onUpdateHand(null); // Clear the table
        return;
    }

    // Scenario 2: Betting round is over, advance the phase
    if (checkEndOfBettingRound(updatedHandState)) {
        if (updatedHandState.phase === 'RIVER' || updatedHandState.phase === 'SHOWDOWN') {
            onUpdateHand({ ...collectBets(updatedHandState), phase: 'SHOWDOWN' });
            toast({ title: "Showdown!", description: "Rodada de apostas finalizada. Declare o vencedor."});
        } else {
            handleAdvancePhase(updatedHandState);
        }
        return;
    }

    // Scenario 3: Betting continues, just update the state
    onUpdateHand(updatedHandState);
  }

  const handlePlayerAction = (action: 'fold' | 'check-call' | 'bet' | 'all-in', amount?: number) => {
    if (!handState || !activePlayer) return;
    
    const newPlayers = [...handState.players];
    const activePlayerIndex = newPlayers.findIndex(p => p.id === activePlayer.id);
    if(activePlayerIndex === -1) return;

    const playerToUpdate = { ...newPlayers[activePlayerIndex] };
    playerToUpdate.hasActed = true;
    let newLastRaise = handState.lastRaise;

    if (action === 'fold') {
        playerToUpdate.isFolded = true;
    } else if (action === 'check-call') {
        const highestBet = Math.max(...newPlayers.map(p => p.bet));
        const callAmount = highestBet - playerToUpdate.bet;

        if (callAmount > 0) { // It's a call
            const amountToCall = Math.min(callAmount, playerToUpdate.stack);
            playerToUpdate.stack -= amountToCall;
            playerToUpdate.bet += amountToCall;
            if (playerToUpdate.stack === 0) {
                playerToUpdate.isAllIn = true;
            }
        } // Otherwise it's a check, no change
    } else if (action === 'bet' && amount) {
        const amountToPot = amount - playerToUpdate.bet;
        if(amountToPot > playerToUpdate.stack) {
            toast({ variant: 'destructive', title: 'Aposta Inválida', description: 'O jogador não tem fichas suficientes.' });
            return;
        }
        playerToUpdate.stack -= amountToPot;
        playerToUpdate.bet = amount;
        newLastRaise = amount; // The new total bet is the new raise amount to match
        if (playerToUpdate.stack === 0) {
            playerToUpdate.isAllIn = true;
        }
    } else if (action === 'all-in') {
        const allInAmount = playerToUpdate.stack + playerToUpdate.bet;
        playerToUpdate.bet = allInAmount;
        playerToUpdate.stack = 0;
        playerToUpdate.isAllIn = true;
        if (allInAmount > newLastRaise) {
            newLastRaise = allInAmount;
        }
    }
    
    newPlayers[activePlayerIndex] = playerToUpdate;
    
    const nextPlayer = getNextPlayer(newPlayers, activePlayer.id);

    const updatedHandState = {
        ...handState,
        players: newPlayers,
        lastRaise: newLastRaise,
        activePlayerId: nextPlayer ? nextPlayer.id : null, 
    };

    processEndOfRound(updatedHandState);
  };

  const confirmBet = () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= handState!.lastRaise) {
        toast({ variant: 'destructive', title: 'Aposta Inválida', description: `O valor precisa ser maior que a última aposta (${handState!.lastRaise}).` });
        return;
    }
    handlePlayerAction('bet', amount);
    setIsBetModalOpen(false);
    setBetAmount('');
  }

  const handleAllIn = () => {
      if(!activePlayer) return;
      handlePlayerAction('all-in');
  }


  if (!handState) {
    return (
      <Card className="bg-gray-900/80 border-gray-700 text-white">
        <CardContent className="p-4 flex items-center justify-center gap-4">
          <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={handleStartNewHand} disabled={players.length < 2}>
            <Play className="mr-2" /> Iniciar Nova Mão
          </Button>
        </CardContent>
      </Card>
    );
  }

  const potentialWinners = handState.players.filter(p => !p.isFolded);
  const totalPotValue = handState.pots.reduce((sum, pot) => sum + pot.amount, 0) + handState.players.reduce((sum, p) => sum + p.bet, 0);

  return (
    <Card className="bg-gray-900/80 border-gray-700 text-white">
      <CardContent className="p-2 md:p-4 flex items-center justify-between gap-4">
         <div className="flex items-center gap-4">
             <Dialog open={isWinnerModalOpen} onOpenChange={setIsWinnerModalOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive" disabled={handState.phase !== 'SHOWDOWN'}>
                        <Hand className="mr-2" /> Declarar Vencedor
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Declarar Vencedor da Mão</DialogTitle>
                        <DialogDescription>Selecione o vencedor da mão para distribuir o pote. O pote será calculado e o stack do jogador atualizado automaticamente.</DialogDescription>
                    </DialogHeader>
                    <div className="my-4 space-y-2">
                        <p className="text-center text-lg">Pote Total: <span className="font-bold text-primary">{
                           totalPotValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        }</span></p>
                        <div className="grid grid-cols-2 gap-2">
                           {potentialWinners.map(p => (
                               <Button
                                 key={p.id}
                                 variant={selectedWinnerId === p.id ? 'default' : 'outline'}
                                 onClick={() => setSelectedWinnerId(p.id)}
                               >
                                   {p.name}
                               </Button>
                           ))}
                        </div>
                    </div>
                    <DialogFooter>
                         <DialogClose asChild>
                           <Button variant="ghost">Cancelar</Button>
                         </DialogClose>
                         <Button onClick={handleEndHandWithWinner} disabled={!selectedWinnerId}>
                            Confirmar e Distribuir Pote
                         </Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>

            <Button variant="secondary" onClick={() => handleAdvancePhase(handState)} disabled={!canManuallyAdvance}>
                <FastForward className="mr-2" /> Próxima Fase (Manual)
            </Button>
         </div>

        {activePlayer && (
            <div className="flex flex-col items-center">
                <span className="text-sm font-semibold">Ação de:</span>
                <span className="text-lg font-bold text-primary">{activePlayer.name}</span>
            </div>
        )}

        <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-transparent text-white" onClick={() => handlePlayerAction('fold')} disabled={!activePlayer}><X className="mr-2"/> Fold</Button>
            <Button variant="outline" className="bg-transparent text-white" onClick={() => handlePlayerAction('check-call')} disabled={!activePlayer}><Check className="mr-2"/> Check/Call</Button>
            <Dialog open={isBetModalOpen} onOpenChange={setIsBetModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700" disabled={!activePlayer}>
                    <CircleDollarSign className="mr-2"/> Bet/Raise
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Registrar Aposta / Aumento</DialogTitle>
                    <DialogDescription>
                        Insira o valor **total** da aposta do jogador nesta rodada (incluindo apostas anteriores). O valor deve ser maior que a aposta anterior.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="bet-amount">Valor Total da Aposta</Label>
                    <Input id="bet-amount" type="number" inputMode="decimal" placeholder={`Maior que ${handState.lastRaise}`} value={betAmount} onChange={e => setBetAmount(e.target.value)} />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={confirmBet}>Confirmar Aposta</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
             <Button className="bg-red-800 hover:bg-red-700" onClick={handleAllIn} disabled={!activePlayer}>
                <Flame className="mr-2"/> All-In
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DealerControls;
