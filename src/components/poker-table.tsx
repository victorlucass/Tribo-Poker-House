"use client";

import React from 'react';
import type { CashGamePlayer, Suit, Rank } from '@/lib/types';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface PokerTableProps {
  players: CashGamePlayer[];
  dealerId?: string | null;
  onSetDealer?: (playerId: string) => void;
}


const PokerTable: React.FC<PokerTableProps> = ({ 
    players, 
    dealerId,
    onSetDealer,
}) => {
  const getSeatPosition = (index: number, totalPlayers: number) => {
    const angle = -Math.PI / 2 + (index / totalPlayers) * 2 * Math.PI;
    const radiusX = 45; // percentage
    const radiusY = 38; // percentage
    const x = 50 + radiusX * Math.cos(angle);
    const y = 50 + radiusY * Math.sin(angle);
    return { left: `${x}%`, top: `${y}%` };
  };
  
  const sortedPlayers = [...players].sort((a, b) => a.seat! - b.seat!);
  const getPlayerStack = (player: CashGamePlayer): number => {
    return player.transactions.reduce((acc, t) => acc + t.amount, 0);
  }

  return (
    <div className="relative w-full aspect-[2/1] max-w-5xl mx-auto my-8 bg-background rounded-lg p-4">
      {/* Table Surface */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-[85%] bg-green-800 rounded-[60px] border-8 border-yellow-800 shadow-2xl">
           <div className="w-full h-full rounded-[60px] border-4 border-yellow-900 opacity-50"/>
        </div>
      </div>
      
      {/* Seats */}
      {sortedPlayers.map((player, index) => {
        const { left, top } = getSeatPosition(index, sortedPlayers.length);
        const isDealer = player.id === dealerId;
        
        return (
          <div
            key={player.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-20"
            style={{ left, top }}
          >
            <div
              className={cn(
                "relative w-24 h-24 rounded-full bg-card border-2 border-primary/50 flex flex-col items-center justify-center p-1 text-center shadow-lg transition-all duration-300",
                onSetDealer && "cursor-pointer hover:border-accent"
              )}
              onClick={() => onSetDealer?.(player.id)}
            >
              <User className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold w-20 truncate text-foreground">
                {player.name}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {getPlayerStack(player).toLocaleString('pt-BR')}
              </span>
            </div>
            
            <div className="absolute -bottom-3 w-14 flex justify-center items-center gap-1">
                {isDealer && (
                    <div title="Dealer" className="w-6 h-6 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-xs font-bold border-2 border-background z-10">
                        D
                    </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PokerTable;

    