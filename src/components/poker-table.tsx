"use client";

import React from 'react';
import type { PlayerHandState, Card, Suit, Rank, Pot } from '@/lib/types';
import { cn } from '@/lib/utils';
import { User, Dices, Flame } from 'lucide-react';

interface PokerTableProps {
  players: PlayerHandState[];
  dealerId?: string | null;
  activePlayerId?: string | null;
  communityCards?: Card[];
  pots?: Pot[];
  onSetDealer?: (playerId: string) => void;
  showCommunityCardAnimation?: boolean;
}

const suitSymbols: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const suitColors: Record<Suit, string> = {
  spades: 'text-foreground',
  hearts: 'text-red-500',
  diamonds: 'text-blue-500',
  clubs: 'text-green-500',
};

const CardComponent: React.FC<{ card: Card, isFaceDown?: boolean, isAnimating?: boolean }> = ({ card, isFaceDown, isAnimating }) => (
    <div className={cn(
        "w-12 h-16 md:w-16 md:h-24 rounded-md shadow-md perspective-1000",
        isAnimating && "transform-style-3d",
    )}>
         <div className={cn("relative w-full h-full transform-style-3d", {"animate-flip-y": isAnimating})}>
            {/* Back of the card */}
            <div className="absolute w-full h-full backface-hidden bg-primary rounded-lg border-2 border-red-800 flex items-center justify-center">
                 <div className="w-4/5 h-4/5 rounded-md border-2 border-red-300/50 flex items-center justify-center">
                     <Dices className="text-primary-foreground opacity-50" />
                 </div>
            </div>
            {/* Front of the card */}
            <div className={cn("absolute w-full h-full backface-hidden transform rotate-y-180 bg-white flex flex-col justify-between p-1 border-2 border-gray-300 rounded-md")}>
                <div className="flex flex-col items-start leading-none">
                    <span className={cn("font-bold text-lg", suitColors[card.suit])}>{card.rank}</span>
                    <span className={cn("text-base", suitColors[card.suit])}>{suitSymbols[card.suit]}</span>
                </div>
                 <div className="flex items-center justify-center text-3xl">
                    <span className={cn(suitColors[card.suit])}>{suitSymbols[card.suit]}</span>
                </div>
                <div className="flex flex-col items-end leading-none rotate-180">
                    <span className={cn("font-bold text-lg", suitColors[card.suit])}>{card.rank}</span>
                    <span className={cn("text-base", suitColors[card.suit])}>{suitSymbols[card.suit]}</span>
                </div>
            </div>
        </div>
    </div>
);


const PokerTable: React.FC<PokerTableProps> = ({ 
    players, 
    dealerId, 
    activePlayerId, 
    communityCards = [], 
    pots = [],
    onSetDealer,
    showCommunityCardAnimation = false,
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
  const currentBetsValue = players.reduce((acc, p) => acc + p.bet, 0);
  const mainPotValue = pots.reduce((acc, p) => acc + p.amount, 0);
  const totalPotValue = mainPotValue + currentBetsValue;

  return (
    <div className="relative w-full aspect-[2/1] max-w-5xl mx-auto my-8 bg-background rounded-lg p-4">
      {/* Table Surface */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-[85%] bg-green-800 rounded-[60px] border-8 border-yellow-800 shadow-2xl">
           <div className="w-full h-full rounded-[60px] border-4 border-yellow-900 opacity-50"/>
        </div>
      </div>
      
      {/* Community Cards and Pot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-2 h-24">
                {Array(5).fill(null).map((_, index) => {
                    const card = communityCards[index];
                    return card
                        ? <CardComponent key={index} card={card} isAnimating={showCommunityCardAnimation} />
                        : <div key={index} className="w-12 h-16 md:w-16 md:h-24 bg-green-900/50 rounded-md border-2 border-dashed border-green-400/30" />
                })}
            </div>
            {totalPotValue > 0 && (
                <div className="bg-black/50 text-white py-1 px-4 rounded-full text-lg font-bold">
                    Pote: {totalPotValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
            )}
        </div>


      {/* Seats */}
      {sortedPlayers.map((player, index) => {
        const { left, top } = getSeatPosition(index, sortedPlayers.length);
        const isDealer = player.id === dealerId;
        const isActive = player.id === activePlayerId;
        // The small/big blind is not directly on the PokerTable anymore, but we can derive it if needed
        // This is a simplification; in a real app, you might pass SB/BB IDs down.

        return (
          <div
            key={player.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-20"
            style={{ left, top }}
          >
            {/* Player Bet */}
            {player.bet > 0 && (
                 <div className="absolute -bottom-12 bg-black/50 text-white text-xs font-semibold py-1 px-3 rounded-full">
                   {player.bet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
            )}
            
            <div
              className={cn(
                "relative w-24 h-24 rounded-full bg-card border-2 border-primary/50 flex flex-col items-center justify-center p-1 text-center shadow-lg transition-all duration-300",
                isActive && "ring-4 ring-primary shadow-primary/50 scale-110",
                player.isFolded && "opacity-40",
                onSetDealer && "cursor-pointer hover:border-accent"
              )}
              onClick={() => onSetDealer?.(player.id)}
            >
              <User className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold w-20 truncate text-foreground">
                {player.name}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {player.stack.toLocaleString('pt-BR')}
              </span>
               {player.isAllIn && (
                  <div className="absolute -top-2 -right-2 bg-red-800 text-white rounded-full p-1 border-2 border-background">
                    <Flame className="h-4 w-4" />
                  </div>
              )}
            </div>

             {/* Player Cards */}
            {player.card1 && player.card2 && (
                <div className="absolute -top-12 flex gap-1">
                    <CardComponent card={player.card1} isFaceDown={true} />
                    <CardComponent card={player.card2} isFaceDown={true} />
                </div>
            )}
            
            <div className="absolute -bottom-3 w-14 flex justify-center items-center gap-1">
                {isDealer && (
                    <div className="w-6 h-6 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-xs font-bold border-2 border-background z-10">
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
