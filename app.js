// Hotseat local UI controller for the Truco engine (engine.js).
// Two players share one device/browser tab; a "pass gate" hides each
// player's hand until it's their turn to look.

const NAMES = ['Player 1', 'Player 2'];
const SUIT_SYMBOL = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' };
const SUIT_RED = { ouros: true, espadas: false, copas: true, paus: false };

let gameState = null;
let revealedSeat = null; // which seat's hand is currently visible on screen

const el = {
  p1Score: document.getElementById('p1-score'),
  p2Score: document.getElementById('p2-score'),
  p1Label: document.getElementById('p1-label'),
  p2Label: document.getElementById('p2-label'),
  viraCard: document.getElementById('vira-card'),
  plays: document.getElementById('plays'),
  trucoBanner: document.getElementById('truco-banner'),
  handTitle: document.getElementById('hand-title'),
  handCards: document.getElementById('hand-cards'),
  actions: document.getElementById('actions'),
  gate: document.getElementById('pass-gate'),
  passTitle: document.getElementById('pass-title'),
  passName: document.getElementById('pass-name'),
  passBtn: document.getElementById('pass-btn'),
  winOverlay: document.getElementById('win-overlay'),
  winText: document.getElementById('win-text'),
  winRestart: document.getElementById('win-restart'),
  toast: document.getElementById('toast'),
};

el.p1Label.textContent = NAMES[0];
el.p2Label.textContent = NAMES[1];

function newMatch() {
  gameState = TrucoEngine.startNewHand('mineiro', 'solo', NAMES, null, [0, 0]);
  revealedSeat = null;
  el.winOverlay.hidden = true;
  render();
}

function actingSeat(state) {
  if (state.truco.pendingStage !== null) {
    return TrucoEngine.seatOfTeam(state.mode, state.truco.respondingTeam);
  }
  return state.turnSeat;
}

function canCallTruco(state, seat) {
  const team = TrucoEngine.seatTeam(state.mode, seat);
  if (state.truco.pendingStage !== null) return false;
  if (state.truco.stage >= 4) return false;
  if (state.truco.callingTeam === team && state.truco.stage > 0) return false;
  return true;
}

function makeCardEl(card, { faceDown = false, playable = false, manilha = false, onClick = null } = {}) {
  const div = document.createElement('div');
  div.className = 'card';
  if (faceDown) {
    div.classList.add('back');
    return div;
  }
  if (SUIT_RED[card.suit]) div.classList.add('red');
  if (manilha) div.classList.add('manilha');
  if (playable) {
    div.classList.add('playable');
    div.addEventListener('click', onClick);
  }
  const rank = document.createElement('div');
  rank.textContent = card.rank;
  const suit = document.createElement('div');
  suit.className = 'suit';
  suit.textContent = SUIT_SYMBOL[card.suit];
  div.appendChild(rank);
  div.appendChild(suit);
  return div;
}

function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

function trucoBannerText(state) {
  if (state.truco.pendingStage !== null) {
    const stageName = TrucoEngine.TRUCO_STAGE_NAMES[state.truco.pendingStage];
    const callerName = NAMES[TrucoEngine.seatOfTeam(state.mode, state.truco.callingTeam)];
    return `${callerName} called for ${TrucoEngine.TRUCO_VALUES[state.truco.pendingStage]} points! Waiting for response...`;
  }
  if (state.truco.stage > 0) {
    return `Playing for ${TrucoEngine.pointsForHandWin(state.truco)} points`;
  }
  return state.maoDeFerro ? 'Mão de Ferro — hands revealed, winner takes all 12!' : '';
}

function render() {
  const state = gameState;
  el.p1Score.textContent = state.scores[0];
  el.p2Score.textContent = state.scores[1];

  el.viraCard.innerHTML = '';
  el.viraCard.appendChild(makeCardEl(state.vira));

  el.plays.innerHTML = '';
  for (const play of state.table) {
    const slot = document.createElement('div');
    slot.className = 'play-slot';
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = NAMES[play.seat];
    slot.appendChild(who);
    slot.appendChild(makeCardEl(play.card, { manilha: TrucoEngine.isManilha(play.card, state.vira) }));
    el.plays.appendChild(slot);
  }

  el.trucoBanner.textContent = trucoBannerText(state);

  const acting = actingSeat(state);

  if (revealedSeat !== acting) {
    el.gate.hidden = false;
    el.passTitle.textContent = `${NAMES[acting]}'s turn`;
    el.passName.textContent = NAMES[acting];
    el.handCards.innerHTML = '';
    el.actions.innerHTML = '';
    el.handTitle.textContent = '';
    return;
  }
  el.gate.hidden = true;

  el.handTitle.textContent = `${NAMES[acting]}'s hand`;
  el.handCards.innerHTML = '';
  const hand = state.hands[acting];
  const pending = state.truco.pendingStage !== null;
  hand.forEach((card, idx) => {
    const playable = !pending;
    const cardEl = makeCardEl(card, {
      manilha: TrucoEngine.isManilha(card, state.vira),
      playable,
      onClick: () => onPlayCard(acting, idx),
    });
    el.handCards.appendChild(cardEl);
  });

  el.actions.innerHTML = '';
  if (pending) {
    el.actions.appendChild(makeBtn('Accept', 'btn-accept', () => onRespond(acting, 'accept')));
    if (state.truco.pendingStage < 4) {
      el.actions.appendChild(makeBtn('Raise', 'btn-raise', () => onRespond(acting, 'raise')));
    }
    el.actions.appendChild(makeBtn('Run', 'btn-run', () => onRespond(acting, 'run')));
  } else if (canCallTruco(state, acting)) {
    const label = state.truco.stage === 0 ? 'Call Truco!' : `Raise to ${TrucoEngine.TRUCO_VALUES[state.truco.stage + 1]}`;
    el.actions.appendChild(makeBtn(label, 'btn-truco', () => onCallTruco(acting)));
  }
}

function makeBtn(label, cls, handler) {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = cls;
  b.addEventListener('click', handler);
  return b;
}

function afterAction(result) {
  gameState = result.state;
  const newActing = actingSeat(gameState);
  if (newActing !== revealedSeat) revealedSeat = null;

  if (result.gameOver) {
    el.winText.textContent = `${NAMES[result.gameWinnerTeam]} wins the match!`;
    el.winOverlay.hidden = false;
  }
  render();
}

function onPlayCard(seat, idx) {
  try {
    afterAction(TrucoEngine.playCard(gameState, seat, idx));
  } catch (e) {
    showToast(e.message);
  }
}
function onCallTruco(seat) {
  try {
    afterAction({ state: TrucoEngine.applyCallTruco(gameState, seat).state, gameOver: false, gameWinnerTeam: null });
  } catch (e) {
    showToast(e.message);
  }
}
function onRespond(seat, response) {
  try {
    afterAction(TrucoEngine.applyRespondTruco(gameState, seat, response));
  } catch (e) {
    showToast(e.message);
  }
}

el.passBtn.addEventListener('click', () => {
  revealedSeat = actingSeat(gameState);
  render();
});
el.winRestart.addEventListener('click', newMatch);

newMatch();
