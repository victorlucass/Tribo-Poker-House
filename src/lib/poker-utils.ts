import type { Card, Rank, Suit, CashGamePlayer, HandState, PlayerHandState, GamePhase, Pot } from './types';

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
    if (!currentActivePlayerId) return null;

    const activePlayers = players.filter(p => !p.isFolded && !p.isAllIn);
    if (activePlayers.length === 0) return null; // No one to act

    const sortedActivePlayers = activePlayers.sort((a, b) => a.seat - b.seat);
    const currentIndex = sortedActivePlayers.findIndex(p => p.id === currentActivePlayerId);

    if (currentIndex === -1) {
        // This case can happen if the current player folded or went all-in
        // We need to find the "next" player from their seat position in the full list
        const fullPlayerList = [...players].sort((a, b) => a.seat - b.seat);
        const lastPlayerSeat = players.find(p => p.id === currentActivePlayerId)?.seat || 0;
        
        for (let i = 1; i <= fullPlayerList.length; i++) {
            const nextSeat = (lastPlayerSeat + i -1) % fullPlayerList.length;
            const nextPlayer = fullPlayerList[nextSeat];
            if (!nextPlayer.isFolded && !nextPlayer.isAllIn) {
                return nextPlayer;
            }
        }
        return null;
    }

    const nextIndex = (currentIndex + 1) % sortedActivePlayers.length;
    return sortedActivePlayers[nextIndex];
}


export function checkEndOfBettingRound(handState: HandState): boolean {
    const activePlayers = handState.players.filter(p => !p.isFolded);
    if (activePlayers.length < 2) return true;

    // All players who are not folded or all-in must have had a chance to act.
    const playersWhoMustAct = activePlayers.filter(p => !p.isAllIn);
    if (playersWhoMustAct.length === 0) return true; // All remaining players are all-in
    
    const allHaveActed = playersWhoMustAct.every(p => p.hasActed);
    if (!allHaveActed) return false;

    // And all those players must have the same bet amount.
    const highestBet = Math.max(...playersWhoMustAct.map(p => p.bet));
    const allBetsEqual = playersWhoMustAct.every(p => p.bet === highestBet);

    return allBetsEqual;
}

export function collectBets(handState: HandState): HandState {
  const players = [...handState.players];
  const existingPots = [...handState.pots];

  const playersInHand = players.filter(p => p.bet > 0 || existingPots.some(pot => pot.eligiblePlayerIds.includes(p.id)));
  const allInPlayers = playersInHand.filter(p => p.isAllIn).sort((a, b) => (a.stack + a.bet) - (b.stack + b.bet));
  const activeBettors = playersInHand.filter(p => !p.isAllIn);

  let pots: Pot[] = existingPots;

  if (allInPlayers.length > 0) {
    // Handle all-in scenarios by creating side pots
    let lastAllInAmount = 0;
    allInPlayers.forEach(allInPlayer => {
      const allInTotalBet = allInPlayer.bet;
      const potAmountForThisAllIn = (allInTotalBet - lastAllInAmount) * playersInHand.filter(p => p.bet >= allInTotalBet).length;
      
      const playersContributingToPot = playersInHand.map(p => {
          const contribution = Math.min(p.bet, allInTotalBet) - lastAllInAmount;
          return {playerId: p.id, contribution};
      });

      const totalPotForThisSlice = playersContributingToPot.reduce((sum, p) => sum + p.contribution, 0);

      const eligiblePlayers = playersInHand
          .filter(p => p.bet >= allInTotalBet || p.isAllIn && p.bet === allInTotalBet)
          .map(p => p.id);

      pots.push({
          amount: totalPotForThisSlice,
          eligiblePlayerIds: eligiblePlayers,
      });

      lastAllInAmount = allInTotalBet;
    });

    const highestAllInBet = Math.max(...allInPlayers.map(p => p.bet));
    const remainingBet = Math.max(...activeBettors.map(p => p.bet), 0);
    
    if (remainingBet > highestAllInBet) {
        const sidePotAmount = activeBettors.reduce((sum, p) => sum + (p.bet - highestAllInBet), 0);
        pots.push({
            amount: sidePotAmount,
            eligiblePlayerIds: activeBettors.map(p => p.id),
        });
    }

  } else {
    // No all-in players, simple pot collection
    const potAmount = players.reduce((sum, p) => sum + p.bet, 0);
    if (pots.length === 0) {
        pots.push({ amount: 0, eligiblePlayerIds: playersInHand.filter(p=>!p.isFolded).map(p => p.id) });
    }
    pots[pots.length - 1].amount += potAmount;
  }
  
  const totalPotValue = pots.reduce((acc, p) => acc + p.amount, 0);
  const totalBetValue = players.reduce((acc, p) => acc + p.bet, 0);
  
  if (Math.abs(totalPotValue - (handState.pots.reduce((acc,p) => acc+p.amount,0) + totalBetValue)) > 0.01) {
       const potAmount = players.reduce((sum, p) => sum + p.bet, 0);
       const mainPot = {
           amount: potAmount + handState.pots.reduce((acc, p) => acc + p.amount, 0),
           eligiblePlayerIds: players.filter(p => !p.isFolded).map(p => p.id)
       };
       pots = [mainPot];
  }


  // Reset player bets for the next round
  const newPlayers = players.map(p => ({ ...p, bet: 0 }));

  return { ...handState, pots, players: newPlayers, lastRaise: 0 };
}


export function awardPotToWinner(handState: HandState, gamePlayers: CashGamePlayer[], winnerId: string): CashGamePlayer[] {
    const winnerInHand = handState.players.find(p => p.id === winnerId);
    if (!winnerInHand) return gamePlayers;

    const totalPot = handState.pots.reduce((sum, p) => sum + p.amount, 0); 

    return gamePlayers.map(gp => {
        const playerInHand = handState.players.find(p => p.id === gp.id);
        if (!playerInHand) return gp; // Player wasn't in this hand

        let newStack = playerInHand.stack;
        if(gp.id === winnerId) {
            newStack += totalPot;
        }

        // This is a simplification. We find the latest transaction and assume it represents the player's buy-in.
        // We then create a new transaction list with just one entry representing the new total stack.
        // A more complex system might track chips won/lost separately.
        const updatedTransactions = [...gp.transactions];
        if (updatedTransactions.length > 0) {
            const newTransaction = { id: 1, type: 'buy-in' as const, amount: newStack, chips: [] }; // Chips are not recalculated here.
            return { ...gp, transactions: [newTransaction] };
        }
        
        return gp; // Return original player if no transactions found
    });
}


export function advanceHandPhase(handState: HandState, dealerId: string): HandState {
    const deck = handState.deck || shuffleDeck(createDeck());
    const newCommunityCards = [...handState.communityCards];

    let nextPhase: GamePhase = handState.phase;

    // Burn card and deal
    if (handState.phase === 'PRE_FLOP') {
        nextPhase = 'FLOP';
        if(deck.length > 3) {
            deck.pop(); // Burn
            newCommunityCards.push(deck.pop()!, deck.pop()!, deck.pop()!);
        }
    } else if (handState.phase === 'FLOP') {
        nextPhase = 'TURN';
         if(deck.length > 1) {
            deck.pop(); // Burn
            newCommunityCards.push(deck.pop()!);
        }
    } else if (handState.phase === 'TURN') {
        nextPhase = 'RIVER';
        if(deck.length > 1) {
            deck.pop(); // Burn
            newCommunityCards.push(deck.pop()!);
        }
    } else if (handState.phase === 'RIVER') {
        nextPhase = 'SHOWDOWN';
    }

    // After a betting round, the first player to act is the first active player to the left of the dealer button.
    const sortedPlayers = [...handState.players].sort((a,b) => a.seat - b.seat);
    const dealerSeatIndex = sortedPlayers.findIndex(p => p.id === dealerId);
    
    let firstToAct: PlayerHandState | null = null;
    if(dealerSeatIndex !== -1) {
        for(let i = 1; i <= sortedPlayers.length; i++) {
            const p = sortedPlayers[(dealerSeatIndex + i) % sortedPlayers.length];
            if(p && !p.isFolded && !p.isAllIn) {
                firstToAct = p;
                break;
            }
        }
    }


    return {
        ...handState,
        phase: nextPhase,
        communityCards: newCommunityCards,
        deck: deck,
        activePlayerId: firstToAct ? firstToAct.id : null, // If no one can act, it's null
        players: handState.players.map(p => ({...p, hasActed: false})), // Reset hasActed for the new round
    };
}


export function startNewHand(players: CashGamePlayer[], currentDealerId: string, smallBlind: number, bigBlind: number): { handState: HandState, nextDealerId: string } {
    const activePlayers = players.filter(p => p.transactions.reduce((acc, t) => acc + t.amount, 0) > 0);
    if (activePlayers.length < 2) {
      throw new Error("Not enough active players with stacks to start a hand.");
    }

    const sortedPlayersBySeat = [...activePlayers].sort((a, b) => a.seat! - b.seat!);
    
    const findNextPlayerIndex = (startIndex: number): number => {
        return (startIndex + 1) % sortedPlayersBySeat.length;
    }

    const currentDealerIndex = sortedPlayersBySeat.findIndex(p => p.id === currentDealerId);
    const nextDealerIndex = findNextPlayerIndex(currentDealerIndex === -1 ? sortedPlayersBySeat.length -1 : currentDealerIndex);
    const nextDealer = sortedPlayersBySeat[nextDealerIndex];

    const smallBlindIndex = findNextPlayerIndex(nextDealerIndex);
    const bigBlindIndex = findNextPlayerIndex(smallBlindIndex);
    const firstToActIndex = findNextPlayerIndex(bigBlindIndex);
    
    const smallBlindPlayer = sortedPlayersBySeat[smallBlindIndex];
    const bigBlindPlayer = sortedPlayersBySeat[bigBlindIndex];
    const firstToActPlayer = sortedPlayersBySeat[firstToActIndex];
    
    const deck = shuffleDeck(createDeck());
    const getPlayerStack = (player: CashGamePlayer): number => {
        return player.transactions.reduce((acc, t) => acc + t.amount, 0);
    }
    
    const playerHandStates: PlayerHandState[] = sortedPlayersBySeat.map(p => {
        const stack = getPlayerStack(p);
        let bet = 0;
        let isAllIn = false;

        if (p.id === smallBlindPlayer.id) {
            bet = Math.min(smallBlind, stack);
        }
        if (p.id === bigBlindPlayer.id) {
            bet = Math.min(bigBlind, stack);
        }
        
        if (bet === stack) {
            isAllIn = true;
        }
        
        return {
            id: p.id,
            name: p.name,
            seat: p.seat!,
            stack: stack - bet,
            bet: bet,
            card1: deck.pop(),
            card2: deck.pop(),
            hasActed: p.id === bigBlindPlayer.id && bigBlind >= stack, // BB is all-in, no option
            isFolded: false,
            isAllIn: isAllIn,
        };
    });

    const handState: HandState = {
        phase: 'PRE_FLOP',
        pots: [],
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
