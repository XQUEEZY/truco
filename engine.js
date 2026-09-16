// Truco (Mineiro / Paulista) rule engine — pure game logic, no I/O, no framework.
// Runs the same in Node and in the browser.

const RANK_ORDER = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const SUIT_ORDER = ['ouros', 'espadas', 'copas', 'paus'];
const TURN_SECONDS = 15;
const TRUCO_VALUES = [1, 3, 6, 9, 12];
const TRUCO_STAGE_NAMES = ['none', 'truco', 'six', 'nine', 'twelve'];
const GAME_POINTS = 12;

function buildDeck() {
  const deck = [];
  for (const suit of SUIT_ORDER) for (const rank of RANK_ORDER) deck.push({ suit, rank });
  return deck;
}

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function manilhaRank(vira) {
  const idx = RANK_ORDER.indexOf(vira.rank);
  return RANK_ORDER[(idx + 1) % RANK_ORDER.length];
}
function isManilha(card, vira) {
  return card.rank === manilhaRank(vira);
}
function cardStrength(card, vira) {
  if (isManilha(card, vira)) return 100 + SUIT_ORDER.indexOf(card.suit);
  return RANK_ORDER.indexOf(card.rank);
}

function seatsForMode(mode) {
  return mode === 'solo' ? 2 : 4;
}
function seatTeam(mode, seat) {
  if (mode === 'solo') return seat === 0 ? 0 : 1;
  return seat % 2;
}
function seatOfTeam(mode, team) {
  const seats = seatsForMode(mode);
  for (let s = 0; s < seats; s++) if (seatTeam(mode, s) === team) return s;
  return team;
}
function nextSeat(seat, totalSeats) {
  return (seat + 1) % totalSeats;
}
function firstToPlaySeat(dealerSeat, mode) {
  return nextSeat(dealerSeat, seatsForMode(mode));
}

function resolveTrick(plays, vira, mode) {
  let best = [];
  let bestStrength = -1;
  for (const p of plays) {
    const s = cardStrength(p.card, vira);
    if (s > bestStrength) { bestStrength = s; best = [p]; }
    else if (s === bestStrength) best.push(p);
  }
  if (best.length === 1) return { winnerSeat: best[0].seat, winnerTeam: seatTeam(mode, best[0].seat), plays };
  return { winnerSeat: null, winnerTeam: null, plays };
}

function checkHandDecided(tricks, dealerSeat, mode) {
  const dealerTeam = seatTeam(mode, dealerSeat);
  const wins = { 0: 0, 1: 0 };
  let firstTrickWinner = null;

  for (let i = 0; i < tricks.length; i++) {
    const t = tricks[i];
    if (i === 0 && t.winnerTeam !== null) firstTrickWinner = t.winnerTeam;

    if (t.winnerTeam === null) {
      if (i === 0) continue;
      const winner = firstTrickWinner ?? dealerTeam;
      return { decided: true, winnerTeam: winner };
    } else {
      wins[t.winnerTeam] += 1;
      if (wins[t.winnerTeam] >= 2) return { decided: true, winnerTeam: t.winnerTeam };
      if (i === 1 && tricks[0].winnerTeam === null) return { decided: true, winnerTeam: t.winnerTeam };
    }
  }

  if (tricks.length >= 3) {
    const winner = firstTrickWinner ?? dealerTeam;
    return { decided: true, winnerTeam: winner };
  }
  return { decided: false, winnerTeam: null };
}

function initialTrucoState() {
  return { stage: 0, pendingStage: null, callingTeam: null, respondingTeam: null, respondDeadline: null };
}
function callTruco(state, callingTeam) {
  if (state.pendingStage !== null) throw new Error('There is already a pending truco call.');
  const nextStage = state.stage + 1;
  if (nextStage > 4) throw new Error('Maximum value (12) already reached.');
  if (state.callingTeam === callingTeam && state.stage > 0) throw new Error('Only the opposing team can raise the stakes.');
  return {
    stage: state.stage,
    pendingStage: nextStage,
    callingTeam,
    respondingTeam: callingTeam === 0 ? 1 : 0,
    respondDeadline: Date.now() + TURN_SECONDS * 1000,
  };
}
function respondTruco(state, respondingTeam, response) {
  if (state.pendingStage === null || state.respondingTeam !== respondingTeam) {
    throw new Error('There is no pending truco call to respond to.');
  }
  if (response === 'run') {
    const pointsIfRun = Math.max(TRUCO_VALUES[state.stage] || 1, 1);
    return {
      state: { stage: state.pendingStage, pendingStage: null, callingTeam: null, respondingTeam: null, respondDeadline: null },
      handEndedTeamWinner: state.callingTeam,
      pointsIfRun,
    };
  }
  if (response === 'accept') {
    return { state: { stage: state.pendingStage, pendingStage: null, callingTeam: state.callingTeam, respondingTeam: null, respondDeadline: null } };
  }
  const newPending = state.pendingStage + 1;
  if (newPending > 4) throw new Error('Maximum value (12) already reached.');
  return {
    state: {
      stage: state.stage,
      pendingStage: newPending,
      callingTeam: respondingTeam,
      respondingTeam: state.callingTeam,
      respondDeadline: Date.now() + TURN_SECONDS * 1000,
    },
  };
}
function pointsForHandWin(state) {
  return TRUCO_VALUES[state.stage] || 1;
}

function isMaoDeFerro(variant, scoreA, scoreB) {
  return variant === 'mineiro' && scoreA === 11 && scoreB === 11;
}

function dealHands(deck, mode) {
  const seats = seatsForMode(mode);
  const hands = Array.from({ length: seats }, () => []);
  let idx = 0;
  for (let c = 0; c < 3; c++) for (let s = 0; s < seats; s++) hands[s].push(deck[idx++]);
  return hands;
}

function startNewHand(variant, mode, seatUserIds, prevDealerSeat, scores, prevHandNumber = null, rng = Math.random) {
  const dealerSeat = prevDealerSeat === null ? 0 : nextSeat(prevDealerSeat, seatsForMode(mode));
  const deck = shuffle(buildDeck(), rng);
  const hands = dealHands(deck, mode);
  const vira = deck[seatsForMode(mode) * 3];
  const maoDeFerro = isMaoDeFerro(variant, scores[0], scores[1]);
  return {
    variant,
    mode,
    seatUserIds,
    dealerSeat,
    turnSeat: firstToPlaySeat(dealerSeat, mode),
    vira,
    hands,
    table: [],
    tricks: [],
    scores,
    truco: initialTrucoState(),
    maoDeFerro,
    revealAll: maoDeFerro,
    lastHandWinnerTeam: null,
    handNumber: prevHandNumber === null ? 1 : prevHandNumber + 1,
    turnDeadline: Date.now() + TURN_SECONDS * 1000,
    forfeitedSeat: null,
  };
}

function playCard(state, seat, cardIndex, rng = Math.random) {
  if (state.turnSeat !== seat) throw new Error("It's not your turn to play.");
  if (state.truco.pendingStage !== null) throw new Error('There is a pending truco call. Respond before playing.');
  const hand = state.hands[seat];
  if (!hand || cardIndex < 0 || cardIndex >= hand.length) throw new Error('Invalid card.');

  const card = hand[cardIndex];
  const newHands = state.hands.map((h, i) => (i === seat ? h.filter((_, ci) => ci !== cardIndex) : h));

  const seats = seatsForMode(state.mode);
  const baseTable = state.table.length >= seats ? [] : state.table;
  const newTable = [...baseTable, { seat, card }];

  let working = { ...state, hands: newHands, table: newTable };

  if (newTable.length < seats) {
    working.turnSeat = nextSeat(seat, seats);
    working.turnDeadline = Date.now() + TURN_SECONDS * 1000;
    return { state: working, gameOver: false, gameWinnerTeam: null };
  }

  const trick = resolveTrick(newTable, state.vira, state.mode);
  const newTricks = [...state.tricks, trick];
  working = { ...working, table: newTable, tricks: newTricks };

  const resolution = checkHandDecided(newTricks, state.dealerSeat, state.mode);
  if (!resolution.decided) {
    working.turnSeat = trick.winnerSeat !== null ? trick.winnerSeat : firstToPlaySeat(state.dealerSeat, state.mode);
    working.turnDeadline = Date.now() + TURN_SECONDS * 1000;
    return { state: working, gameOver: false, gameWinnerTeam: null };
  }

  const winnerTeam = resolution.winnerTeam;
  const points = working.maoDeFerro ? GAME_POINTS : pointsForHandWin(working.truco);
  const newScores = [...working.scores];
  if (working.maoDeFerro) {
    newScores[winnerTeam] = GAME_POINTS;
  } else {
    newScores[winnerTeam] = Math.min(GAME_POINTS, newScores[winnerTeam] + points);
  }

  if (newScores[winnerTeam] >= GAME_POINTS) {
    return {
      state: { ...working, scores: newScores, lastHandWinnerTeam: winnerTeam },
      gameOver: true,
      gameWinnerTeam: winnerTeam,
    };
  }

  const nextHand = startNewHand(working.variant, working.mode, working.seatUserIds, working.dealerSeat, newScores, working.handNumber, rng);
  return {
    state: {
      ...nextHand,
      lastHandWinnerTeam: winnerTeam,
      lastHandTable: newTable,
      lastHandTricks: newTricks,
      lastHandPoints: points,
    },
    gameOver: false,
    gameWinnerTeam: null,
  };
}

function applyCallTruco(state, seat) {
  const team = seatTeam(state.mode, seat);
  return { state: { ...state, truco: callTruco(state.truco, team) } };
}

function applyRespondTruco(state, seat, response, rng = Math.random) {
  const team = seatTeam(state.mode, seat);
  const result = respondTruco(state.truco, team, response);

  if (result.handEndedTeamWinner !== undefined && result.pointsIfRun !== undefined) {
    const winnerTeam = result.handEndedTeamWinner;
    const points = state.maoDeFerro ? GAME_POINTS : result.pointsIfRun;
    const newScores = [...state.scores];
    if (state.maoDeFerro) {
      newScores[winnerTeam] = GAME_POINTS;
    } else {
      newScores[winnerTeam] = Math.min(GAME_POINTS, newScores[winnerTeam] + points);
    }
    if (newScores[winnerTeam] >= GAME_POINTS) {
      return {
        state: { ...state, truco: result.state, scores: newScores, lastHandWinnerTeam: winnerTeam },
        gameOver: true,
        gameWinnerTeam: winnerTeam,
      };
    }
    const nextHand = startNewHand(state.variant, state.mode, state.seatUserIds, state.dealerSeat, newScores, state.handNumber, rng);
    return {
      state: {
        ...nextHand,
        lastHandWinnerTeam: winnerTeam,
        lastHandTable: state.table,
        lastHandTricks: state.tricks,
        lastHandPoints: points,
      },
      gameOver: false,
      gameWinnerTeam: null,
    };
  }

  const turnDeadline = result.state.pendingStage === null ? Date.now() + TURN_SECONDS * 1000 : state.turnDeadline;
  return { state: { ...state, truco: result.state, turnDeadline }, gameOver: false, gameWinnerTeam: null };
}

const TrucoEngine = {
  RANK_ORDER, SUIT_ORDER, TURN_SECONDS, TRUCO_VALUES, TRUCO_STAGE_NAMES, GAME_POINTS,
  buildDeck, shuffle, manilhaRank, isManilha, cardStrength,
  seatsForMode, seatTeam, seatOfTeam, nextSeat, firstToPlaySeat,
  resolveTrick, checkHandDecided,
  initialTrucoState, callTruco, respondTruco, pointsForHandWin, isMaoDeFerro,
  dealHands, startNewHand, playCard, applyCallTruco, applyRespondTruco,
};

if (typeof module !== 'undefined' && module.exports) module.exports = TrucoEngine;
