const serverUrl = (() => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const override = params.get('server');
  if (override) return override;
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:4000';
  }
  return `${window.location.protocol}//${window.location.hostname}:4000`;
})();

const socket = io(serverUrl, {
  transports: ['websocket'],
  autoConnect: true
});

const state = {
  code: null,
  isHost: false,
  inGame: false,
  difficulty: 'easy'
};

const panels = {
  auth: document.getElementById('auth-panel'),
  lobby: document.getElementById('lobby-panel'),
  game: document.getElementById('game-panel'),
  results: document.getElementById('results-panel')
};

const lobbyCodeLabel = document.getElementById('lobby-code');
const playerList = document.getElementById('player-list');
const lobbyInfo = document.getElementById('lobby-info');
const difficultyControl = document.getElementById('difficulty-control');
const lobbyDifficultySelect = document.getElementById('lobby-difficulty');
const startButton = document.getElementById('start-game');
const questionText = document.getElementById('question-text');
const roundNumber = document.getElementById('round-number');
const roundMeta = document.getElementById('round-meta');
const leaderboardList = document.getElementById('leaderboard-list');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const answerFeedback = document.getElementById('answer-feedback');
const resultsList = document.getElementById('results-list');

const createForm = document.getElementById('create-form');
const hostNameInput = document.getElementById('host-name');
const difficultySelect = document.getElementById('difficulty');

const joinForm = document.getElementById('join-form');
const joinNameInput = document.getElementById('join-name');
const roomCodeInput = document.getElementById('room-code');

const leaveButton = document.getElementById('leave-game');
const playAgainButton = document.getElementById('play-again');

function showPanel(key) {
  Object.entries(panels).forEach(([panelKey, el]) => {
    if (panelKey === key) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

function renderPlayers(players = []) {
  playerList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    li.textContent = `${player.name} — ${player.score} pts`;
    if (player.id === socket.id) {
      const you = document.createElement('span');
      you.textContent = ' (You)';
      li.appendChild(you);
    }
    playerList.appendChild(li);
  });
}

function renderLeaderboard(players = []) {
  leaderboardList.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = player.name;
    const score = document.createElement('span');
    score.textContent = `${player.score} pts`;
    li.appendChild(name);
    li.appendChild(score);
    leaderboardList.appendChild(li);
  });
}

function renderResults(players = []) {
  resultsList.innerHTML = '';
  players.forEach((player, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>#${index + 1} ${player.name}</span><span>${player.score} pts</span>`;
    resultsList.appendChild(li);
  });
}

function updateLobbyInfo({ round }) {
  const hostLabel = state.isHost ? 'You are the host.' : 'Waiting for host actions…';
  lobbyInfo.textContent = `${hostLabel} Difficulty: ${state.difficulty}. Current round: ${round || 0}.`;
  startButton.style.display = state.isHost ? 'inline-flex' : 'none';
  if (state.isHost) {
    difficultyControl.classList.remove('hidden');
    lobbyDifficultySelect.value = state.difficulty;
  } else {
    difficultyControl.classList.add('hidden');
  }
}

function resetGameUI() {
  state.inGame = false;
  questionText.textContent = 'Waiting for the host to start…';
  answerForm.reset();
  answerInput.disabled = true;
  answerFeedback.textContent = '';
  leaderboardList.innerHTML = '';
}

createForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = hostNameInput.value.trim();
  if (!name) return;
  socket.emit('createLobby', {
    name,
    difficulty: difficultySelect.value
  });
});

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = joinNameInput.value.trim();
  const code = roomCodeInput.value.trim();
  if (!name || !code) return;
  socket.emit('joinLobby', {
    name,
    code
  });
});

startButton.addEventListener('click', () => {
  if (!state.isHost || !state.code) return;
  socket.emit('startGame', { code: state.code });
});

leaveButton.addEventListener('click', () => {
  window.location.reload();
});

playAgainButton.addEventListener('click', () => {
  window.location.reload();
});

answerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.code) return;
  const answer = answerInput.value;
  socket.emit('submitAnswer', { code: state.code, answer });
  answerInput.disabled = true;
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  alert('Disconnected from server. Please refresh.');
});

socket.on('lobbyCreated', ({ code, host }) => {
  state.code = code;
  state.isHost = host;
  state.difficulty = difficultySelect.value;
  lobbyCodeLabel.textContent = code;
  showPanel('lobby');
  updateLobbyInfo({ round: 0 });
});

socket.on('lobbyJoined', ({ code, host }) => {
  state.code = code;
  state.isHost = host;
  lobbyCodeLabel.textContent = code;
  showPanel('lobby');
  updateLobbyInfo({ round: 0 });
});

socket.on('lobbyUpdate', ({ code, players, round, difficulty }) => {
  if (code !== state.code) return;
  if (difficulty) {
    state.difficulty = difficulty;
    lobbyDifficultySelect.value = difficulty;
  }
  renderPlayers(players);
  renderLeaderboard(players.sort((a, b) => b.score - a.score));
  updateLobbyInfo({ round });
});

socket.on('hostPromotion', () => {
  state.isHost = true;
  updateLobbyInfo({ round: 0 });
});

lobbyDifficultySelect.addEventListener('change', (event) => {
  if (!state.isHost || !state.code) {
    event.target.value = state.difficulty;
    return;
  }
  state.difficulty = event.target.value;
  socket.emit('setDifficulty', { code: state.code, difficulty: state.difficulty });
});

socket.on('newQuestion', ({ prompt, round, remainingRounds }) => {
  state.inGame = true;
  showPanel('game');
  roundNumber.textContent = round;
  roundMeta.textContent = `${remainingRounds} rounds remaining`;
  questionText.textContent = prompt;
  answerInput.disabled = false;
  answerInput.value = '';
  answerInput.focus();
  answerFeedback.textContent = '';
});

socket.on('answerResult', ({ correct, correctAnswer }) => {
  answerFeedback.textContent = correct
    ? 'Correct! +10 pts'
    : `Not quite. Correct answer: ${correctAnswer}`;
});

socket.on('roundResults', ({ players, correctAnswer }) => {
  renderLeaderboard(players);
  answerFeedback.textContent = `Round complete. Correct answer: ${correctAnswer}`;
});

socket.on('gameOver', ({ players }) => {
  renderResults(players);
  showPanel('results');
});

socket.on('errorMessage', (message) => {
  alert(message);
});

resetGameUI();
