// Hotseat local UI controller for the Truco engine (engine.js).
// Two players share one device/browser tab; a "pass gate" hides each
// player's hand until it's their turn to look.

const NAMES = ['Player 1', 'Player 2'];
const SUIT_SYMBOL = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' };
const SUIT_RED = { ouros: true, espadas: false, copas: true, paus: false };
const STAGE_NAMES = ['', 'TRUCO', 'SIX', 'NINE', 'TWELVE'];

let gameState = null;
let revealedSeat = null; // which seat's hand is currently visible on screen

const el = {
  score0: document.getElementById('score-0'),
  score1: document.getElementById('score-1'),
  pips0: document.getElementById('pips-0'),
  pips1: document.getElementById('pips-1'),
  scoreRow0: document.getElementById('score-row-0'),
  scoreRow1: document.getElementById('score-row-1'),
  name0: document.getElementById('name-0'),
  name1: document.getElementById('name-1'),
  stakeLabel: document.getElementById('stake-label'),
  manilhaChain: document.getElementById('manilha-chain'),
  oppAvatar: document.getElementById('opp-avatar'),
  oppName: document.getElementById('opp-name'),
  oppCards: document.getElementById('opp-cards'),
  viraCard: document.getElementById('vira-card'),
  playOpp: document.getElementById('play-opp'),
  playYou: document.getElementById('play-you'),
  trucoOverlay: document.getElementById('truco-overlay'),
  trucoSub: document.getElementById('truco-sub-text'),
  trucoActions: document.getElementById('truco-actions'),
  endOverlay: document.getElementById('end-overlay'),
  endTitle: document.getElementById('end-title'),
  endScore: document.getElementById('end-score'),
  endRestart: document.getElementById('end-restart'),
  turnRow: document.getElementById('turn-row'),
  handCards: document.getElementById('hand-cards'),
  myAvatar: document.getElementById('my-avatar'),
  myName: document.getElementById('my-name'),
  gate: document.getElementById('pass-gate'),
  passTitle: document.getElementById('pass-title'),
  passName: document.getElementById('pass-name'),
  passBtn: document.getElementById('pass-btn'),
  toast: document.getElementById('toast'),
};

el.name0.textContent = NAMES[0];
el.name1.textContent = NAMES[1];

function newMatch() {
  gameState = TrucoEngine.startNewHand('mineiro', 'solo', NAMES, null, [0, 0]);
  revealedSeat = null;
  el.endOverlay.hidden = true;
  render();
}

function actingSeat(state) {
  if (state.truco.pendingStage !== null) {
    return TrucoEngine.seatOfTeam(state.mode, state.truco.respondingTeam);
  }
  return state.turnSeat;
}
function otherSeat(seat) { return seat === 0 ? 1 : 0; }

function canCallTruco(state, seat) {
  const team = TrucoEngine.seatTeam(state.mode, seat);
  if (state.truco.pendingStage !== null) return false;
  if (state.truco.stage >= 4) return false;
  if (state.truco.callingTeam === team && state.truco.stage > 0) return false;
  return true;
}

function suitClass(suit) { return SUIT_RED[suit] ? 'suit-red' : 'suit-black'; }

function cardFaceEl(card, { size = 'hand', manilha = false, playable = false, disabled = false, onClick = null } = {}) {
  const div = document.createElement('div');
  div.className = `card face ${size}` + (manilha ? ' manilha' : '') + (playable && !disabled ? ' playable' : '') + (disabled ? ' disabled' : '');

  const topCorner = document.createElement('div');
  topCorner.className = 'card-corner';
  topCorner.innerHTML = `<span class="rank ${suitClass(card.suit)}">${card.rank}</span><span class="suit ${suitClass(card.suit)}">${SUIT_SYMBOL[card.suit]}</span>`;

  const center = document.createElement('div');
  center.className = 'card-center-suit';
  center.innerHTML = `<span class="${suitClass(card.suit)}">${SUIT_SYMBOL[card.suit]}</span>`;

  const bottomCorner = document.createElement('div');
  bottomCorner.className = 'card-corner bottom';
  bottomCorner.innerHTML = `<span class="rank ${suitClass(card.suit)}">${card.rank}</span><span class="suit ${suitClass(card.suit)}">${SUIT_SYMBOL[card.suit]}</span>`;

  div.appendChild(topCorner);
  div.appendChild(center);
  div.appendChild(bottomCorner);

  if (manilha) {
    const badge = document.createElement('div');
    badge.className = 'manilha-badge';
    badge.textContent = 'MANILHA';
    div.appendChild(badge);
  }
  if (playable && !disabled && onClick) {
    div.addEventListener('click', onClick);
  }
  return div;
}
function cardBackEl(size = 'mini') {
  const div = document.createElement('div');
  div.className = `card back ${size}`;
  div.innerHTML = '<span class="back-icon">♠</span>';
  return div;
}

function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.toast.classList.remove('show'), 2200);
}

function renderScore(state) {
  el.score0.textContent = state.scores[0];
  el.score1.textContent = state.scores[1];
  el.stakeLabel.textContent = state.truco.stage > 0 ? `WORTH ${TrucoEngine.TRUCO_VALUES[state.truco.stage]} PTS` : 'WORTH 1 PT';
  el.stakeLabel.classList.toggle('raised', state.truco.stage > 0);

  [el.pips0, el.pips1].forEach((container, teamIdx) => {
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const trick = state.tricks[i];
      const pip = document.createElement('div');
      pip.className = 'pip';
      if (trick) {
        if (trick.winnerTeam === null) pip.classList.add('tied');
        else if (trick.winnerTeam === teamIdx) pip.classList.add(teamIdx === 0 ? 'won-a' : 'won-b');
      }
      container.appendChild(pip);
    }
  });
}

function renderManilhaHud(state) {
  const mRank = TrucoEngine.manilhaRank(state.vira);
  const order = [
    { suit: 'ouros', label: '4th lowest' },
    { suit: 'espadas', label: '3rd' },
    { suit: 'copas', label: '2nd' },
    { suit: 'paus', label: '👑 highest' },
  ];
  el.manilhaChain.innerHTML = '';
  order.forEach((entry, i) => {
    const chip = document.createElement('div');
    chip.className = 'manilha-chip' + (i === 3 ? ' top' : '');
    chip.innerHTML = `<span style="font-size:8px;font-weight:700;color:#64748b;">${entry.label}</span><span class="rank ${suitClass(entry.suit)}">${mRank}${SUIT_SYMBOL[entry.suit]}</span>`;
    el.manilhaChain.appendChild(chip);
    if (i < order.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '<';
      el.manilhaChain.appendChild(sep);
    }
  });
}

function renderTable(state, revealed) {
  const opp = otherSeat(revealed);
  el.oppName.textContent = NAMES[opp];
  el.oppAvatar.textContent = NAMES[opp].slice(-1);
  el.myName.textContent = NAMES[revealed];
  el.myAvatar.textContent = NAMES[revealed].slice(-1);
  el.myAvatar.classList.toggle('active', state.turnSeat === revealed);
  el.myAvatar.classList.toggle('mine', true);
  el.oppAvatar.classList.toggle('active', state.turnSeat === opp);

  el.oppCards.innerHTML = '';
  const oppCount = state.hands[opp] ? state.hands[opp].length : 0;
  for (let i = 0; i < oppCount; i++) el.oppCards.appendChild(cardBackEl('mini'));

  const viraContent = cardFaceEl(state.vira, { size: 'vira-size' });
  viraContent.id = 'vira-card';
  viraContent.classList.add('vira-active');
  el.viraCard.replaceWith(viraContent);
  el.viraCard = viraContent;

  const seats = TrucoEngine.seatsForMode(state.mode);
  const trickComplete = state.table.length >= seats;
  const currentTrick = trickComplete ? state.tricks[state.tricks.length - 1] : null;

  function renderPlaySlot(container, seat, isMine) {
    container.innerHTML = '';
    const play = state.table.find((p) => p.seat === seat);
    if (!play) return;
    const isWinner = currentTrick && currentTrick.winnerSeat === seat;
    const isTie = currentTrick && currentTrick.winnerSeat === null;

    if (isWinner) {
      const pill = document.createElement('span');
      pill.className = 'win-pill ' + (isMine ? 'mine' : 'opp');
      pill.textContent = isMine ? '👑 YOU WON THE HAND' : '👑 WON THE HAND';
      if (!isMine) container.appendChild(pill);
    } else if (isTie) {
      const pill = document.createElement('span');
      pill.className = 'win-pill tie';
      pill.textContent = '🤝 TIE';
      if (!isMine) container.appendChild(pill);
    }

    const cardEl = cardFaceEl(play.card, { size: 'table', manilha: TrucoEngine.isManilha(play.card, state.vira) });
    cardEl.classList.add('played-card', isMine ? 'rot-pos' : 'rot-neg');
    if (isWinner) cardEl.classList.add(isMine ? 'won' : 'won-opp');
    if (isTie) cardEl.classList.add('tie');
    container.appendChild(cardEl);

    if (isWinner && isMine) {
      const pill = document.createElement('span');
      pill.className = 'win-pill mine';
      pill.textContent = '👑 YOU WON THE HAND';
      container.appendChild(pill);
    } else if (isTie && isMine) {
      const pill = document.createElement('span');
      pill.className = 'win-pill tie';
      pill.textContent = '🤝 TIE';
      container.appendChild(pill);
    } else if (!isWinner && !isTie) {
      const tag = document.createElement('span');
      tag.className = 'name-tag ' + (isMine ? 'mine' : 'opp');
      tag.textContent = NAMES[seat];
      container.appendChild(tag);
    }
  }
  renderPlaySlot(el.playOpp, opp, false);
  renderPlaySlot(el.playYou, revealed, true);
}

function renderTurnRow(state, revealed) {
  el.turnRow.innerHTML = '';
  const isMyTurn = state.truco.pendingStage === null && state.turnSeat === revealed;
  if (isMyTurn) {
    const pill = document.createElement('span');
    pill.className = 'turn-pill';
    pill.innerHTML = '<span class="dot"></span> YOUR TURN TO PLAY!';
    el.turnRow.appendChild(pill);
  }
  if (state.truco.pendingStage === null && canCallTruco(state, revealed)) {
    const btn = document.createElement('button');
    btn.className = 'btn-gold';
    btn.textContent = state.truco.stage === 0 ? 'CALL TRUCO' : `RAISE TO ${TrucoEngine.TRUCO_VALUES[Math.min(state.truco.stage + 1, 4)]}`;
    btn.addEventListener('click', () => onCallTruco(revealed));
    el.turnRow.appendChild(btn);
  }
}

function renderTrucoOverlay(state, revealed) {
  if (state.truco.pendingStage === null) {
    el.trucoOverlay.hidden = true;
    return;
  }
  el.trucoOverlay.hidden = false;
  document.getElementById('truco-big-text').textContent = `💥 ${STAGE_NAMES[state.truco.pendingStage]}!`;
  el.trucoSub.innerHTML = `Worth <b>${TrucoEngine.TRUCO_VALUES[state.truco.pendingStage]}</b> points in the match`;

  el.trucoActions.innerHTML = '';
  const respondingSeat = TrucoEngine.seatOfTeam(state.mode, state.truco.respondingTeam);
  if (respondingSeat !== revealed) return; // waiting screen handled by pass-gate

  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'btn-accept';
  acceptBtn.textContent = 'ACCEPT';
  acceptBtn.addEventListener('click', () => onRespond(revealed, 'accept'));
  el.trucoActions.appendChild(acceptBtn);

  if (state.truco.pendingStage < 4) {
    const raiseBtn = document.createElement('button');
    raiseBtn.className = 'btn-raise';
    raiseBtn.textContent = `RAISE (${STAGE_NAMES[state.truco.pendingStage + 1]})`;
    raiseBtn.addEventListener('click', () => onRespond(revealed, 'raise'));
    el.trucoActions.appendChild(raiseBtn);
  }

  const runBtn = document.createElement('button');
  runBtn.className = 'btn-run';
  runBtn.textContent = 'RUN';
  runBtn.addEventListener('click', () => onRespond(revealed, 'run'));
  el.trucoActions.appendChild(runBtn);
}

function render() {
  const state = gameState;
  const acting = actingSeat(state);

  renderScore(state);
  renderManilhaHud(state);

  if (revealedSeat !== acting) {
    el.gate.hidden = false;
    el.passTitle.textContent = `${NAMES[acting]}'s turn`;
    el.passName.textContent = NAMES[acting];
    el.handCards.innerHTML = '';
    el.turnRow.innerHTML = '';
    el.trucoOverlay.hidden = true;
    return;
  }
  el.gate.hidden = true;

  renderTable(state, revealedSeat);
  renderTurnRow(state, revealedSeat);
  renderTrucoOverlay(state, revealedSeat);

  el.handCards.innerHTML = '';
  const hand = state.hands[revealedSeat];
  const pending = state.truco.pendingStage !== null;
  const isMyTurn = !pending && state.turnSeat === revealedSeat;
  hand.forEach((card, idx) => {
    const cardEl = cardFaceEl(card, {
      size: 'hand',
      manilha: TrucoEngine.isManilha(card, state.vira),
      playable: isMyTurn,
      disabled: !isMyTurn,
      onClick: () => onPlayCard(revealedSeat, idx),
    });
    el.handCards.appendChild(cardEl);
  });
}

function afterAction(result) {
  gameState = result.state;
  const newActing = actingSeat(gameState);
  if (newActing !== revealedSeat) revealedSeat = null;

  if (result.gameOver) {
    el.endTitle.textContent = `${NAMES[result.gameWinnerTeam]} WON THE MATCH!`;
    el.endTitle.className = 'end-title win';
    el.endScore.textContent = `Final Score: ${gameState.scores[0]} x ${gameState.scores[1]}`;
    el.endOverlay.hidden = false;
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
el.endRestart.addEventListener('click', newMatch);

newMatch();
