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

// Tipos para Estado da Mão (Hand State)
export type GamePhase = 'PRE_DEAL' | 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export interface PlayerHandState {
    id: string; // Player ID
    name: string;
    seat: number;
    stack: number; // Stack at the beginning of the hand
    bet: number; // Current bet in this round
    card1?: Card;
    card2?: Card;
    hasActed: boolean;
    isFolded: boolean;
    isAllIn: boolean;
}

export interface Pot {
    amount: number;
    eligiblePlayerIds: string[];
}


export interface HandState {
    phase: GamePhase;
    pots: Pot[];
    communityCards: Card[];
    deck?: Card[]; // Keep track of the deck to deal cards
    activePlayerId: string | null;
    lastRaise: number;
    smallBlindAmount: number;
    bigBlindAmount: number;
    players: PlayerHandState[];
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
    type: 'buy-in' | 'rebuy' | 'add-on' | 'admin-join';
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
    status: 'pending' | 'approved' | 'declined';
    requestedAt: string;
}

export interface CashGame {
    id: string;
    ownerId: string; // ID of the user who created the game
    name: string;
    chips: CashGameChip[];
    players: CashGamePlayer[];
    cashedOutPlayers: CashedOutPlayer[];
    requests: JoinRequest[];
    positionsSet: boolean;
    dealerId: string | null;
    croupierId?: string | null; // UID of the admin currently acting as croupier
    createdAt: string; // Store as ISO string
    handState?: HandState; // Optional HandState object
}

export interface UserProfile {
  uid: string;
  name: string;
  nickname: string;
  email: string;
  role: 'admin' | 'player' | 'super_admin';
}
