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

interface DealerControlsProps {
  game: CashGame;
  onUpdateHand: (handState: Partial<HandState> | null) => void;
  onUpdateGame: (gameData: Partial<CashGame>) => void;
}

const DealerControls: React.FC<DealerControlsProps> = ({ game, onUpdateHand, onUpdateGame }) => {
  const { handState, players, dealerId } = game;
  const activePlayer = handState?.players.find(p => p.id === handState?.activePlayerId);

  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [betAmount, setBetAmount] = useState<string>('');
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);

  
  const canAdvancePhase = useMemo(() => {
    if (!handState) return false;
    const isBettingOver = checkEndOfBettingRound(handState.players, handState.lastRaise);
    return isBettingOver && handState.phase !== 'SHOWDOWN' && handState.phase !== 'RIVER';
  }, [handState]);

  const handleStartNewHand = () => {
    if (!dealerId || players.length < 2) return;
    const { handState: newHand, nextDealerId } = startNewHand(players, dealerId, 1, 2); 
    onUpdateHand(newHand);
    onUpdateGame({ dealerId: nextDealerId });
  };
  
  const handleEndHandWithWinner = () => {
    if(!handState || !selectedWinnerId) return;
    const updatedPlayers = awardPotToWinner(handState, players, selectedWinnerId);
    onUpdateGame({ players: updatedPlayers });
    onUpdateHand(null); // Clear the table for the next hand
    setIsWinnerModalOpen(false);
    setSelectedWinnerId(null);
  };

  const handleAdvancePhase = () => {
    if (!handState || !canAdvancePhase) return;
    const betsCollectedState = collectBets(handState);
    const nextPhaseState = advanceHandPhase(betsCollectedState);
    onUpdateHand(nextPhaseState);
  };

  const handlePlayerAction = (action: 'fold' | 'check-call' | 'bet' | 'all-in', amount?: number) => {
    if (!handState || !activePlayer) return;
    
    let newPot = handState.pot;
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
        if(callAmount > 0) { // It's a call
            const amountToCall = Math.min(callAmount, playerToUpdate.stack); // Cannot call more than stack
            playerToUpdate.stack -= amountToCall;
            playerToUpdate.bet += amountToCall;
            if(playerToUpdate.stack === 0) {
                playerToUpdate.isAllIn = true;
            }
        } // Otherwise it's a check, no change in bet/stack
    } else if (action === 'bet' && amount) {
        const totalBet = amount;
        const amountToPot = totalBet - playerToUpdate.bet;
        playerToUpdate.stack -= amountToPot;
        playerToUpdate.bet = totalBet;
        newLastRaise = totalBet;
        if (playerToUpdate.stack === 0) {
            playerToUpdate.isAllIn = true;
        }
    } else if (action === 'all-in') {
        const allInAmount = playerToUpdate.stack + playerToUpdate.bet;
        playerToUpdate.bet = allInAmount;
        playerToUpdate.stack = 0;
        playerToUpdate.isAllIn = true;
        if(allInAmount > newLastRaise) {
            newLastRaise = allInAmount;
        }
    }
    
    newPlayers[activePlayerIndex] = playerToUpdate;
    
    const activePlayersLeft = newPlayers.filter(p => !p.isFolded);
    if (activePlayersLeft.length === 1) {
        const winner = activePlayersLeft[0];
        const finalHandState = { ...handState, players: newPlayers };
        const updatedGamePlayers = awardPotToWinner(finalHandState, game.players, winner.id);
        onUpdateGame({ players: updatedGamePlayers });
        onUpdateHand(null);
        return;
    }

    const nextPlayer = getNextPlayer(newPlayers, activePlayer.id);

    onUpdateHand({
        ...handState,
        players: newPlayers,
        lastRaise: newLastRaise,
        activePlayerId: nextPlayer ? nextPlayer.id : null, 
    });
  };

  const confirmBet = () => {
    const amount = parseFloat(betAmount);
    if (!isNaN(amount) && amount > 0) {
        handlePlayerAction('bet', amount);
    }
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

  return (
    <Card className="bg-gray-900/80 border-gray-700 text-white">
      <CardContent className="p-2 md:p-4 flex items-center justify-between gap-4">
         <div className="flex items-center gap-4">
             <Dialog open={isWinnerModalOpen} onOpenChange={setIsWinnerModalOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive">
                        <Hand className="mr-2" /> Encerrar Mão
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Declarar Vencedor</DialogTitle>
                        <DialogDescription>Selecione o vencedor da mão para distribuir o pote.</DialogDescription>
                    </DialogHeader>
                    <div className="my-4 space-y-2">
                        <p className="text-center text-lg">Pote Total: <span className="font-bold text-primary">{
                           (handState.pot + handState.players.reduce((acc, p) => acc + p.bet, 0))
                           .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

            <Button variant="secondary" onClick={handleAdvancePhase} disabled={!canAdvancePhase}>
                <FastForward className="mr-2" /> Próxima Fase
            </Button>
         </div>

        {activePlayer && (
            <div className="flex flex-col items-center">
                <span className="text-sm font-semibold">Ação de:</span>
                <span className="text-lg font-bold text-primary">{activePlayer.name}</span>
            </div>
        )}

        <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-transparent text-white" onClick={() => handlePlayerAction('fold')}><X className="mr-2"/> Fold</Button>
            <Button variant="outline" className="bg-transparent text-white" onClick={() => handlePlayerAction('check-call')}><Check className="mr-2"/> Check/Call</Button>
            <Dialog open={isBetModalOpen} onOpenChange={setIsBetModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                    <CircleDollarSign className="mr-2"/> Bet/Raise
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Registrar Aposta / Aumento</DialogTitle>
                    <DialogDescription>
                        Insira o valor **total** da aposta do jogador nesta rodada (incluindo apostas anteriores).
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="bet-amount">Valor Total da Aposta</Label>
                    <Input id="bet-amount" type="number" inputMode="decimal" placeholder={`Mínimo: ${handState.lastRaise}`} value={betAmount} onChange={e => setBetAmount(e.target.value)} />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={confirmBet}>Confirmar Aposta</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
             <Button className="bg-red-800 hover:bg-red-700" onClick={handleAllIn}>
                <Flame className="mr-2"/> All-In
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DealerControls;
