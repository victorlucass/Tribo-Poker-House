import type { Card, Rank, Suit, CashGamePlayer as Player, HandState, PlayerHandState, GamePhase } from './types';

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};
const SUIT_VALUES: Record<Suit, number> = {
  'clubs': 1, 'diamonds': 2, 'hearts': 3, 'spades': 4,
};

// Fisher-Yates Shuffle
const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
};

const compareCards = (a: Card, b: Card): number => {
  const rankValueA = RANK_VALUES[a.rank];
  const rankValueB = RANK_VALUES[b.rank];
  if (rankValueA !== rankValueB) {
    return rankValueB - rankValueA; // Higher rank first
  }
  return SUIT_VALUES[b.suit] - SUIT_VALUES[a.suit]; // Higher suit as tie-breaker
};

export const sortPlayersAndSetDealer = (players: Player[]): { playersWithDealtCards: Player[], sortedPlayers: Player[], dealer: Player } => {
  if (players.length < 2) {
    throw new Error("Cannot sort positions with fewer than 2 players.");
  }

  const deck = shuffleDeck(createDeck());
  
  // Deal one card to each player (in original registration order)
  const playersWithDealtCards = players.map((player, index) => ({
    ...player,
    card: deck[index],
  }));

  // Create a separate array for sorting to find the dealer
  const playersToSort = [...playersWithDealtCards];

  // Find the player with the highest card
  const highestCardPlayer = playersToSort.sort((a, b) => compareCards(a.card!, b.card!))[0];
  
  const dealerIndex = playersWithDealtCards.findIndex(p => p.id === highestCardPlayer.id);

  // Set seat numbers starting from the dealer
  const sortedPlayers: Player[] = [];
  for (let i = 0; i < playersWithDealtCards.length; i++) {
    const currentPlayerIndex = (dealerIndex + i) % playersWithDealtCards.length;
    sortedPlayers.push({
      ...playersWithDealtCards[currentPlayerIndex],
      seat: i + 1, // Dealer is seat 1
    });
  }
  
  // Final array sorted by the new seat number
  sortedPlayers.sort((a, b) => a.seat! - b.seat!);

  return { playersWithDealtCards, sortedPlayers, dealer: highestCardPlayer };
};


// --- New Hand Management Logic ---

export function getNextPlayer(players: PlayerHandState[], currentActivePlayerId: string | null): PlayerHandState | null {
    const activePlayers = players.filter(p => !p.isFolded && !p.isAllIn);
    if (activePlayers.length === 0) return null;

    const currentIndex = currentActivePlayerId ? activePlayers.findIndex(p => p.id === currentActivePlayerId) : -1;
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    
    return activePlayers[nextIndex];
}

export function startNewHand(players: Player[], currentDealerId: string, smallBlind: number, bigBlind: number): { handState: HandState, nextDealerId: string } {
    const deck = shuffleDeck(createDeck());
    const sortedPlayers = [...players].sort((a, b) => a.seat! - b.seat!);
    
    // Determine the next dealer
    const currentDealerIndex = sortedPlayers.findIndex(p => p.id === currentDealerId);
    const nextDealerIndex = (currentDealerIndex + 1) % sortedPlayers.length;
    const nextDealer = sortedPlayers[nextDealerIndex];
    
    // Determine blinds based on the new dealer
    const smallBlindIndex = (nextDealerIndex + 1) % sortedPlayers.length;
    const bigBlindIndex = (nextDealerIndex + 2) % sortedPlayers.length;
    const smallBlindPlayer = sortedPlayers[smallBlindIndex];
    const bigBlindPlayer = sortedPlayers[bigBlindIndex];
    
    // Determine who acts first (UTG)
    const firstToActIndex = (bigBlindIndex + 1) % sortedPlayers.length;
    const firstToActPlayer = sortedPlayers[firstToActIndex];

    // Get player's total investment to determine their stack for the hand
    const getPlayerStack = (player: Player): number => {
        return player.transactions.reduce((acc, t) => acc + t.amount, 0);
    }

    const playerHandStates: PlayerHandState[] = sortedPlayers.map(p => {
        const stack = getPlayerStack(p);
        let bet = 0;
        if (p.id === smallBlindPlayer.id) bet = Math.min(smallBlind, stack);
        if (p.id === bigBlindPlayer.id) bet = Math.min(bigBlind, stack);
        
        return {
            id: p.id,
            name: p.name,
            seat: p.seat!,
            stack: stack - bet,
            bet: bet,
            card1: deck.pop(),
            card2: deck.pop(),
            hasActed: false,
            isFolded: false,
            isAllIn: (stack - bet) === 0,
        };
    });

    const handState: HandState = {
        phase: 'PRE_FLOP',
        pot: playerHandStates.reduce((acc, p) => acc + p.bet, 0),
        communityCards: [],
        activePlayerId: firstToActPlayer.id,
        lastRaise: bigBlind,
        smallBlindAmount: smallBlind,
        bigBlindAmount: bigBlind,
        smallBlindPlayerId: smallBlindPlayer.id,
        bigBlindPlayerId: bigBlindPlayer.id,
        players: playerHandStates,
    };

    return { handState, nextDealerId: nextDealer.id };
}
