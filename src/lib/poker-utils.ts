import type { Card, Rank, Suit, CashGamePlayer, HandState, PlayerHandState, GamePhase } from './types';

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

export const sortPlayersAndSetDealer = (players: CashGamePlayer[]): { playersWithDealtCards: CashGamePlayer[], sortedPlayers: CashGamePlayer[], dealer: CashGamePlayer } => {
  if (players.length < 2) {
    throw new Error("Cannot sort positions with fewer than 2 players.");
  }

  const deck = shuffleDeck(createDeck());
  
  const playersWithDealtCards = players.map((player, index) => ({
    ...player,
    card: deck[index],
  }));

  const playersToSort = [...playersWithDealtCards];

  const highestCardPlayer = playersToSort.sort((a, b) => compareCards(a.card!, b.card!))[0];
  
  const dealerIndex = playersWithDealtCards.findIndex(p => p.id === highestCardPlayer.id);

  const sortedPlayers: CashGamePlayer[] = [];
  for (let i = 0; i < playersWithDealtCards.length; i++) {
    const currentPlayerIndex = (dealerIndex + i) % playersWithDealtCards.length;
    sortedPlayers.push({
      ...playersWithDealtCards[currentPlayerIndex],
      seat: i + 1,
    });
  }
  
  sortedPlayers.sort((a, b) => a.seat! - b.seat!);

  return { playersWithDealtCards, sortedPlayers, dealer: highestCardPlayer };
};

export function getNextPlayer(players: PlayerHandState[], currentActivePlayerId: string | null): PlayerHandState | null {
    const activePlayers = players.filter(p => !p.isFolded && !p.isAllIn);
    if (activePlayers.length <= 1) return null; // No next player if only one or zero left

    const currentIndex = currentActivePlayerId ? activePlayers.findIndex(p => p.id === currentActivePlayerId) : -1;
    // If current player isn't found (e.g. they folded), start from the beginning
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    
    const nextPlayer = activePlayers[nextIndex];

    // Check if everyone has acted (or is all-in)
    const allActed = activePlayers.every(p => p.hasActed || p.isAllIn);
    if (allActed) {
        // And check if all bets are equal
        const highestBet = Math.max(...activePlayers.map(p => p.bet));
        const allBetsEqual = activePlayers.every(p => p.bet === highestBet || p.isAllIn);
        if (allBetsEqual) {
            return null; // End of betting round
        }
    }
    
    return nextPlayer;
}


export function checkEndOfBettingRound(players: PlayerHandState[], lastRaise: number): boolean {
    const activePlayers = players.filter(p => !p.isFolded && !p.isAllIn);
    if (activePlayers.length === 0) return true;

    // Everyone has had a chance to act
    const allHaveActed = activePlayers.every(p => p.hasActed);
    if (!allHaveActed) return false;
    
    const highestBet = Math.max(...players.map(p => p.bet));
    const allBetsEqual = activePlayers.every(p => p.bet === highestBet);

    return allBetsEqual;
}

export function collectBets(handState: HandState): HandState {
    let newPot = handState.pot;
    const newPlayers = handState.players.map(p => {
        newPot += p.bet;
        return { ...p, bet: 0, hasActed: false };
    });
    return { ...handState, pot: newPot, players: newPlayers, lastRaise: 0 };
}


export function awardPotToWinner(handState: HandState, gamePlayers: CashGamePlayer[], winnerId?: string): CashGamePlayer[] {
    let winner: PlayerHandState | undefined;

    if (winnerId) {
        winner = handState.players.find(p => p.id === winnerId);
    } else {
       // TODO: Implement hand evaluation logic to find the real winner at showdown
       // For now, let's find the last player who hasn't folded.
       const potentialWinners = handState.players.filter(p => !p.isFolded);
       if (potentialWinners.length === 1) {
           winner = potentialWinners[0];
       } else {
           // Fallback if there's no clear winner (e.g. showdown)
           winner = potentialWinners[0];
       }
    }

    if (!winner) return gamePlayers; // No winner found, return original players

    // Calculate total pot from player bets and the main pot
    const totalPot = handState.pot + handState.players.reduce((sum, p) => sum + p.bet, 0);

    const updatedGamePlayers = gamePlayers.map(gp => {
        if (gp.id === winner!.id) {
            const playerTransaction = gp.transactions.find(t => t.type === 'buy-in' || t.type === 'rebuy');
            if (playerTransaction) {
                 const newTransaction: PlayerTransaction = {
                    id: gp.transactions.length + 1,
                    type: 'rebuy', // Treat winnings as a rebuy for stack tracking
                    amount: totalPot,
                    chips: [], // We don't know the chip breakdown of the pot
                };
                // This is a simplified way to update the stack.
                // A more robust solution might need to update a `stack` field directly.
                // For now we add a transaction representing the win.
                const updatedTransactions = [...gp.transactions, newTransaction];
                return { ...gp, transactions: updatedTransactions };
            }
        }
        return gp;
    });

    return updatedGamePlayers;
}


export function advanceHandPhase(handState: HandState): HandState {
    const deck = handState.deck || shuffleDeck(createDeck());
    const newCommunityCards = [...handState.communityCards];

    let nextPhase: GamePhase = handState.phase;

    if (handState.phase === 'PRE_FLOP') {
        nextPhase = 'FLOP';
        deck.pop(); // Burn card
        newCommunityCards.push(deck.pop()!, deck.pop()!, deck.pop()!);
    } else if (handState.phase === 'FLOP') {
        nextPhase = 'TURN';
        deck.pop(); // Burn card
        newCommunityCards.push(deck.pop()!);
    } else if (handState.phase === 'TURN') {
        nextPhase = 'RIVER';
        deck.pop(); // Burn card
        newCommunityCards.push(deck.pop()!);
    } else if (handState.phase === 'RIVER') {
        nextPhase = 'SHOWDOWN';
    }

    const firstToAct = getNextPlayer(handState.players, handState.smallBlindPlayerId);

    return {
        ...handState,
        phase: nextPhase,
        communityCards: newCommunityCards,
        deck: deck,
        activePlayerId: firstToAct ? firstToAct.id : null,
        players: handState.players.map(p => ({...p, hasActed: false})), // Reset hasActed for new round
    };
}


export function startNewHand(players: CashGamePlayer[], currentDealerId: string, smallBlind: number, bigBlind: number): { handState: HandState, nextDealerId: string } {
    const deck = shuffleDeck(createDeck());
    const sortedPlayers = [...players].sort((a, b) => a.seat! - b.seat!);
    
    const currentDealerIndex = sortedPlayers.findIndex(p => p.id === currentDealerId);
    const nextDealerIndex = (currentDealerIndex + 1) % sortedPlayers.length;
    const nextDealer = sortedPlayers[nextDealerIndex];
    
    // Handle heads-up (2 players) blinds differently
    const isHeadsUp = sortedPlayers.length === 2;
    const smallBlindIndex = isHeadsUp ? nextDealerIndex : (nextDealerIndex + 1) % sortedPlayers.length;
    const bigBlindIndex = (smallBlindIndex + 1) % sortedPlayers.length;

    const smallBlindPlayer = sortedPlayers[smallBlindIndex];
    const bigBlindPlayer = sortedPlayers[bigBlindIndex];
    
    const firstToActIndex = isHeadsUp ? smallBlindIndex : (bigBlindIndex + 1) % sortedPlayers.length;
    const firstToActPlayer = sortedPlayers[firstToActIndex];

    const getPlayerStack = (player: CashGamePlayer): number => {
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
        deck: deck,
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
