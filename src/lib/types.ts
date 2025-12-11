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
    id: string; // Firebase UID
    name: string;
    transactions: PlayerTransaction[];
    finalChipCounts: Record<string, number>;
    seat: number | null;
    card: Card | null;
}

export interface PlayerTransaction {
    id: number;
    type: 'buy-in' | 'rebuy' | 'add-on';
    amount: number;
    chips: { chipId: number; count: number }[];
}


export interface CashedOutPlayer {
  id: string;
  name: string;
  transactions: PlayerTransaction[];
  cashedOutAt: string; // Store as ISO string
  amountReceived: number;
  chipCounts: Record<string, number>; // Firestore can't store Maps, use object
  totalInvested: number;
}

export interface JoinRequest {
    userId: string;
    userName: string;
    status: 'pending';
    requestedAt: string;
}

export interface CashGame {
    id: string;
    name: string;
    chips: CashGameChip[];
    players: CashGamePlayer[];
    cashedOutPlayers: CashedOutPlayer[];
    requests: JoinRequest[];
    positionsSet: boolean;
    dealerId: string | null;
    createdAt: string; // Store as ISO string
    ownerId: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  nickname: string;
  email: string;
  role: 'root' | 'admin' | 'player';
}
