'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hand, Play, FastForward, Undo, Check, X, CircleDollarSign } from 'lucide-react';
import type { CashGame, HandState } from '@/lib/types';
import { startNewHand, getNextPlayer } from '@/lib/poker-utils';

interface DealerControlsProps {
  game: CashGame;
  onUpdateHand: (handState: Partial<HandState> | null) => void;
}

const DealerControls: React.FC<DealerControlsProps> = ({ game, onUpdateHand }) => {
  const { handState, players, dealerId } = game;
  const activePlayer = handState?.players.find(p => p.id === handState?.activePlayerId);

  const handleStartNewHand = () => {
    if (!dealerId || players.length < 2) return;
    // For now, let's assume fixed blinds. This can be made configurable later.
    const newHand = startNewHand(players, dealerId, 1, 2); 
    onUpdateHand(newHand);
  };
  
  const handleEndHand = () => {
    // This would eventually have logic to determine the winner and distribute the pot.
    // For now, it just resets the hand.
    onUpdateHand(null);
  };

  const handlePlayerAction = (action: 'fold' | 'check' | 'bet', amount?: number) => {
    if (!handState || !activePlayer) return;
    
    let newPot = handState.pot;
    const newPlayers = handState.players.map(p => {
        if (p.id === activePlayer.id) {
            const updatedPlayer = { ...p, hasActed: true };
            if (action === 'fold') {
                updatedPlayer.isFolded = true;
            }
            if (action === 'bet' && amount) {
                const betAmount = Math.min(amount, p.stack);
                updatedPlayer.bet += betAmount;
                updatedPlayer.stack -= betAmount;
                if (updatedPlayer.stack === 0) {
                  updatedPlayer.isAllIn = true;
                }
                newPot += betAmount;
            }
            return updatedPlayer;
        }
        return p;
    });

    // TODO: Add logic to check if the betting round is over.
    // For now, just moves to the next player.
    const nextPlayer = getNextPlayer(newPlayers, activePlayer.id);

    onUpdateHand({
        ...handState,
        pot: newPot,
        players: newPlayers,
        activePlayerId: nextPlayer ? nextPlayer.id : null,
    });
  };

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
            <Button variant="secondary" disabled>
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
            <Button variant="outline" className="bg-transparent text-white" onClick={() => handlePlayerAction('check')}><Check className="mr-2"/> Check</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handlePlayerAction('bet', 10)}>
                <CircleDollarSign className="mr-2"/> Bet 10
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DealerControls;
