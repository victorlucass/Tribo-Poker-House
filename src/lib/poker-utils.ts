import type { Card, Rank, Suit, CashGamePlayer as Player } from './types';

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
