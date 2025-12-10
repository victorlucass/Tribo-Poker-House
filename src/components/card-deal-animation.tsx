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

const CardFace: React.FC<{ rank: Rank, suit: Suit }> = ({ rank, suit }) => (
    <div className={cn("absolute w-full h-full backface-hidden flex flex-col justify-between p-2 rounded-lg bg-white border-2 border-gray-300")}>
        <div className="flex flex-col items-start">
            <span className={cn("font-bold text-2xl leading-none", suitColors[suit])}>{rank}</span>
            <span className={cn("text-xl leading-none", suitColors[suit])}>{suitSymbols[suit]}</span>
        </div>
        <div className="flex items-center justify-center">
            <span className={cn("text-5xl", suitColors[suit])}>{suitSymbols[suit]}</span>
        </div>
        <div className="flex flex-col items-end rotate-180">
            <span className={cn("font-bold text-2xl leading-none", suitColors[suit])}>{rank}</span>
            <span className={cn("text-xl leading-none", suitColors[suit])}>{suitSymbols[suit]}</span>
        </div>
    </div>
);

const CardBack: React.FC = () => (
    <div className={cn("absolute w-full h-full backface-hidden bg-primary rounded-lg border-2 border-red-800 flex items-center justify-center")}>
        <div className="w-4/5 h-4/5 rounded-md border-2 border-red-300/50 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground opacity-50"><path d="m12 2 10 10-10 10-10-10Z"/></svg>
        </div>
    </div>
);


const CardDealAnimation: React.FC<CardDealAnimationProps> = ({ players, onComplete }) => {
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

    useEffect(() => {
        if (players.length === 0) return;

        const revealTimer = setTimeout(() => {
            const interval = setInterval(() => {
                setCurrentPlayerIndex(prevIndex => {
                    const nextIndex = prevIndex + 1;
                    if (nextIndex > players.length) {
                        clearInterval(interval);
                        const completeTimeout = setTimeout(onComplete, 2000);
                        return prevIndex;
                    }
                    return nextIndex;
                });
            }, 1500); // Time between each player reveal

            return () => {
                clearInterval(interval);
            }
        }, 500); // Initial delay

        return () => clearTimeout(revealTimer);

    }, [players, onComplete]);
  

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center overflow-hidden">
            <div className="w-full max-w-sm h-full flex flex-col items-center justify-center">
                {players.map((player, index) => {
                    const isActive = currentPlayerIndex === index + 1;
                    const wasActive = currentPlayerIndex > index + 1;

                    return (
                        <div
                            key={player.id}
                            className={cn(
                                "absolute transition-all duration-500 ease-in-out",
                                isActive ? 'opacity-100 transform scale-100' : 'opacity-0 transform scale-90',
                                wasActive ? 'opacity-0 transform -translate-y-20' : ''
                            )}
                            style={{ zIndex: players.length - index }}
                        >
                            <div className={cn("relative w-48 h-64 perspective-1000")}>
                               <div className={cn("relative w-full h-full transform-style-3d", {"animate-flip-y": isActive})}>
                                    <div className="absolute w-full h-full backface-hidden transform rotate-y-180">
                                      {player.card && <CardFace rank={player.card.rank} suit={player.card.suit} />}
                                    </div>
                                    <div className="absolute w-full h-full backface-hidden">
                                      <CardBack />
                                    </div>
                                </div>
                            </div>
                             <div className={cn("mt-4 text-center text-white text-2xl font-bold transition-opacity duration-500 delay-500", isActive ? 'opacity-100' : 'opacity-0')}>
                                {player.name}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CardDealAnimation;
