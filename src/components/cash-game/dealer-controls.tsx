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
  
  const canAdvancePhase = useMemo(() => {
    if (!handState) return false;
    const isBettingOver = checkEndOfBettingRound(handState.players, handState.lastRaise);
    return isBettingOver && handState.phase !== 'RIVER';
  }, [handState]);

  const handleStartNewHand = () => {
    if (!dealerId || players.length < 2) return;
    const { handState: newHand, nextDealerId } = startNewHand(players, dealerId, 1, 2); 
    onUpdateHand(newHand);
    onUpdateGame({ dealerId: nextDealerId });
  };
  
  const handleEndHand = () => {
    if(!handState) return;
    // This logic now correctly awards the pot to the winner(s)
    const updatedPlayers = awardPotToWinner(handState, players);
    onUpdateGame({ players: updatedPlayers });
    onUpdateHand(null);
  };

  const handleAdvancePhase = () => {
    if (!handState || !canAdvancePhase) return;
    const betsCollectedState = collectBets(handState);
    const nextPhaseState = advanceHandPhase(betsCollectedState);
    onUpdateHand(nextPhaseState);
  };

  const handlePlayerAction = (action: 'fold' | 'check' | 'bet' | 'all-in', amount?: number) => {
    if (!handState || !activePlayer) return;
    
    let newPot = handState.pot;
    const newPlayers = [...handState.players];
    const activePlayerIndex = newPlayers.findIndex(p => p.id === activePlayer.id);
    if(activePlayerIndex === -1) return;

    const playerToUpdate = { ...newPlayers[activePlayerIndex] };
    playerToUpdate.hasActed = true;

    if (action === 'fold') {
        playerToUpdate.isFolded = true;
    } else if (action === 'check') {
        // Valid only if bet is equal to lastRaise, otherwise it should be a call
    } else if (action === 'bet' && amount) {
        const totalBet = amount; // The modal now provides the total bet amount
        const amountToPot = totalBet - playerToUpdate.bet;
        playerToUpdate.stack -= amountToPot;
        playerToUpdate.bet = totalBet;
        if (playerToUpdate.stack === 0) {
            playerToUpdate.isAllIn = true;
        }
    } else if (action === 'all-in') {
        const allInAmount = playerToUpdate.stack + playerToUpdate.bet;
        const amountToPot = playerToUpdate.stack;
        playerToUpdate.stack = 0;
        playerToUpdate.bet = allInAmount;
        playerToUpdate.isAllIn = true;
    }
    
    newPlayers[activePlayerIndex] = playerToUpdate;
    
    // Check for winner by fold
    const activePlayers = newPlayers.filter(p => !p.isFolded);
    if (activePlayers.length === 1) {
        // End the hand and award pot to the winner
        const finalHandState = { ...handState, players: newPlayers };
        const updatedGamePlayers = awardPotToWinner(finalHandState, game.players, activePlayers[0].id);
        onUpdateGame({ players: updatedGamePlayers });
        onUpdateHand(null); // This will clear the table for the next hand
        return;
    }


    const nextPlayer = getNextPlayer(newPlayers, activePlayer.id);

    onUpdateHand({
        ...handState,
        players: newPlayers,
        activePlayerId: nextPlayer ? nextPlayer.id : null, // If null, betting round is over
    });
  };

  const confirmBet = () => {
    const amount = parseFloat(betAmount);
    if (!isNaN(amount) && amount > 0) {
        // The amount from the modal is the TOTAL bet for the round
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

  return (
    <Card className="bg-gray-900/80 border-gray-700 text-white">
      <CardContent className="p-2 md:p-4 flex items-center justify-between gap-4">
         <div className="flex items-center gap-4">
            <Button variant="destructive" onClick={handleEndHand}>
                <Hand className="mr-2" /> Encerrar Mão
            </Button>
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
            <Button variant="outline" className="bg-transparent text-white" onClick={() => handlePlayerAction('check')}><Check className="mr-2"/> Check/Call</Button>
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
