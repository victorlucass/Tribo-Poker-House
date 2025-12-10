"use client";

import React from 'react';
import type { CashGamePlayer as Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface PokerTableProps {
  players: Player[];
  dealerId: number | null;
}

const MAX_PLAYERS = 10;

const PokerTable: React.FC<PokerTableProps> = ({ players, dealerId }) => {
  const getSeatPosition = (index: number, totalPlayers: number) => {
    const angle = (index / totalPlayers) * 2 * Math.PI;
    const radiusX = 45; // percentage
    const radiusY = 30; // percentage
    const x = 50 + radiusX * Math.cos(angle);
    const y = 50 + radiusY * Math.sin(angle);
    return { left: `${x}%`, top: `${y}%` };
  };

  const sortedPlayers = [...players].sort((a, b) => a.seat! - b.seat!);

  return (
    <div className="relative w-full aspect-[2/1] max-w-4xl mx-auto my-8">
      {/* Table Surface */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full bg-green-800 rounded-[50%] border-8 border-yellow-800 shadow-2xl">
           <div className="w-full h-full rounded-[50%] border-4 border-yellow-900 opacity-50"/>
        </div>
      </div>

      {/* Seats */}
      {sortedPlayers.map((player, index) => {
        const { left, top } = getSeatPosition(index, sortedPlayers.length);
        const isDealer = player.id === dealerId;
        return (
          <div
            key={player.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left, top }}
          >
            <div
              className={cn(
                "w-16 h-16 rounded-full bg-card border-2 border-primary/50 flex flex-col items-center justify-center p-1 text-center shadow-lg",
                isDealer && "border-accent ring-2 ring-accent"
              )}
            >
              <User className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold truncate text-foreground">
                {player.name}
              </span>
            </div>
            {isDealer && (
                <div className="absolute -bottom-5 w-6 h-6 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-xs font-bold border-2 border-background">
                    D
                </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PokerTable;
