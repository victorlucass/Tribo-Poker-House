"use client";

import React, { useEffect, useState } from 'react';
import type { CashGamePlayer as Player, Suit, Rank } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CardDealAnimationProps {
  players: Player[];
  onComplete: () => void;
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

const CardFace: React.FC<{ rank: Rank, suit: Suit, isFlipping: boolean }> = ({ rank, suit, isFlipping }) => (
    <div className={cn("absolute w-full h-full backface-hidden flex flex-col justify-between p-1 rounded-lg bg-white border border-gray-300", { 'animate-flip-card': isFlipping })}>
        <div className="flex flex-col items-start">
            <span className={cn("font-bold text-lg leading-none", suitColors[suit])}>{rank}</span>
            <span className={cn("text-xs leading-none", suitColors[suit])}>{suitSymbols[suit]}</span>
        </div>
        <div className="flex flex-col items-end">
            <span className={cn("font-bold text-lg leading-none rotate-180", suitColors[suit])}>{rank}</span>
            <span className={cn("text-xs leading-none rotate-180", suitColors[suit])}>{suitSymbols[suit]}</span>
        </div>
    </div>
);

const CardBack: React.FC<{ isFlipping: boolean }> = ({ isFlipping }) => (
    <div className={cn("absolute w-full h-full backface-hidden bg-primary rounded-lg border border-red-800 flex items-center justify-center", { 'animate-flip-card': isFlipping })}>
        <div className="w-4/5 h-4/5 rounded-md border-2 border-red-300/50 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground opacity-50"><path d="m12 2 10 10-10 10-10-10Z"/></svg>
        </div>
    </div>
);


const CardDealAnimation: React.FC<CardDealAnimationProps> = ({ players, onComplete }) => {
  const [dealtCards, setDealtCards] = useState<number[]>([]);
  const [flippingCards, setFlippingCards] = useState<number[]>([]);

  useEffect(() => {
    const dealTimer = setTimeout(() => {
      let index = 0;
      const interval = setInterval(() => {
        setDealtCards(prev => [...prev, players[index].id]);
        index++;
        if (index === players.length) {
          clearInterval(interval);
          
          // Start flipping after all cards are dealt
          const flipTimer = setTimeout(() => {
             let flipIndex = 0;
             const flipInterval = setInterval(() => {
                setFlippingCards(prev => [...prev, players[flipIndex].id]);
                flipIndex++;
                if(flipIndex === players.length) {
                    clearInterval(flipInterval);
                     // All animations are done
                    setTimeout(onComplete, 2000);
                }
             }, 200);
          }, 500); // Wait half a second after dealing
        }
      }, 300); // Stagger deal animation
    }, 500); // Initial delay

    return () => clearTimeout(dealTimer);
  }, [players, onComplete]);
  
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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="relative w-full max-w-4xl aspect-[2/1]">
        {/* Deck */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-16 h-24 bg-primary rounded-lg border-2 border-red-300/50 shadow-2xl flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground opacity-50"><path d="m12 2 10 10-10 10-10-10Z"/></svg>
            </div>
        </div>
        
        {sortedPlayers.map((player, index) => {
          if (!dealtCards.includes(player.id)) return null;

          const { left, top } = getSeatPosition(index, sortedPlayers.length);
          const isFlipping = flippingCards.includes(player.id);
          
          const endTransform = `translate(calc(${left} - 50%), calc(${top} - 50%))`;

          return (
            <div
              key={player.id}
              className="absolute top-1/2 left-1/2 w-16 h-24 perspective-1000"
              style={{
                 ['--transform-end' as any]: endTransform,
                 animationName: 'deal-card',
                 animationFillMode: 'forwards',
                 animationDuration: '0.5s',
                 animationTimingFunction: 'ease-out'
              }}
            >
                <div className={cn("relative w-full h-full transform-style-3d", {"": isFlipping})}>
                    <CardBack isFlipping={isFlipping} />
                    <CardFace rank={player.card!.rank} suit={player.card!.suit} isFlipping={isFlipping} />
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CardDealAnimation;
