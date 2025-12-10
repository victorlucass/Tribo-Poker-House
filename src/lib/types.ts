export interface BlindLevel {
  id: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export interface Player {
  id: number;
  name: string;
  balance: number;
  rebuys: number;
  addons: number;
}

export interface RoundWinner {
  round: number;
  winnerName: string;
}

// Tipos para Card
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}


// Tipos para Cash Game
export interface CashGameChip {
    id: number;
    value: number;
    color: string;
    name: string;
}

export interface CashGamePlayer {
    id: number;
    name: string;
    transactions: PlayerTransaction[];
    finalChipCounts?: Map<number, number>;
    seat?: number; // Posição na mesa
    card?: Card; // Carta recebida no sorteio
}


export interface PlayerTransaction {
    id: number;
    type: 'buy-in' | 'rebuy' | 'add-on';
    amount: number;
    chips: { chipId: number; count: number }[];
}


export interface CashedOutPlayer {
  id: number;
  name: string;
  transactions: PlayerTransaction[];
  cashedOutAt: Date;
  amountReceived: number;
  chipCounts: Map<number, number>;
  totalInvested: number;
}
