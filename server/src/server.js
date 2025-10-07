const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 4000;
const ROUND_LIMIT = parseInt(process.env.ROUND_LIMIT || '10', 10);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const lobbies = new Map();

function generateLobbyCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (lobbies.has(code));
  return code;
}

function generateQuestion(difficulty = 'easy') {
  const operations = ['+', '-', '*'];
  const op = operations[Math.floor(Math.random() * operations.length)];
  let a;
  let b;

  switch (difficulty) {
    case 'medium':
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      break;
    case 'hard':
      a = Math.floor(Math.random() * 90) + 10;
      b = Math.floor(Math.random() * 90) + 10;
      break;
    case 'easy':
    default:
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
      break;
  }

  let answer;
  switch (op) {
    case '+':
      answer = a + b;
      break;
    case '-':
      answer = a - b;
      break;
    case '*':
      answer = a * b;
      break;
  }

  return {
    prompt: `${a} ${op} ${b}`,
    answer
  };
}

function createLobby(hostSocket, hostName) {
  const code = generateLobbyCode();
  const lobby = {
    code,
    hostId: hostSocket.id,
    players: new Map(),
    round: 0,
    answers: new Map(),
    difficulty: 'easy'
  };

  lobby.players.set(hostSocket.id, {
    id: hostSocket.id,
    name: hostName,
    score: 0
  });

  lobbies.set(code, lobby);
  hostSocket.join(code);
  return lobby;
}

function emitLobbyState(lobby) {
  io.to(lobby.code).emit('lobbyUpdate', {
    code: lobby.code,
    round: lobby.round,
    difficulty: lobby.difficulty,
    players: Array.from(lobby.players.values())
  });
}

function broadcastQuestion(lobby) {
  const { prompt } = lobby.currentQuestion;
  io.to(lobby.code).emit('newQuestion', {
    prompt,
    round: lobby.round,
    remainingRounds: ROUND_LIMIT - lobby.round
  });
}

function startNextRound(lobby) {
  if (lobby.round >= ROUND_LIMIT) {
    io.to(lobby.code).emit('gameOver', {
      players: Array.from(lobby.players.values()).sort((a, b) => b.score - a.score)
    });
    return;
  }

  lobby.round += 1;
  lobby.answers.clear();
  lobby.currentQuestion = generateQuestion(lobby.difficulty);
  emitLobbyState(lobby);
  broadcastQuestion(lobby);
}

io.on('connection', (socket) => {
  socket.on('createLobby', ({ name, difficulty }) => {
    if (!name) {
      socket.emit('errorMessage', 'Name is required');
      return;
    }

    const lobby = createLobby(socket, name.trim());
    if (difficulty) {
      lobby.difficulty = difficulty;
    }

    emitLobbyState(lobby);
    socket.emit('lobbyCreated', { code: lobby.code, host: true });
  });

  socket.on('joinLobby', ({ code, name }) => {
    const normalizedCode = (code || '').toUpperCase();
    const lobby = lobbies.get(normalizedCode);

    if (!lobby) {
      socket.emit('errorMessage', 'Lobby not found');
      return;
    }

    if (!name) {
      socket.emit('errorMessage', 'Name is required');
      return;
    }

    lobby.players.set(socket.id, {
      id: socket.id,
      name: name.trim(),
      score: 0
    });

    socket.join(lobby.code);
    emitLobbyState(lobby);
    socket.emit('lobbyJoined', { code: lobby.code, host: lobby.hostId === socket.id });
  });

  socket.on('startGame', ({ code }) => {
    const lobby = lobbies.get((code || '').toUpperCase());
    if (!lobby) {
      socket.emit('errorMessage', 'Lobby not found');
      return;
    }

    if (socket.id !== lobby.hostId) {
      socket.emit('errorMessage', 'Only the host can start the game');
      return;
    }

    startNextRound(lobby);
  });

  socket.on('submitAnswer', ({ code, answer }) => {
    const lobby = lobbies.get((code || '').toUpperCase());
    if (!lobby) {
      socket.emit('errorMessage', 'Lobby not found');
      return;
    }

    if (!lobby.players.has(socket.id)) {
      socket.emit('errorMessage', 'You are not part of this lobby');
      return;
    }

    if (!lobby.currentQuestion) {
      socket.emit('errorMessage', 'No active question');
      return;
    }

    if (lobby.answers.has(socket.id)) {
      socket.emit('errorMessage', 'Answer already submitted for this round');
      return;
    }

    const numericAnswer = Number(answer);
    const isCorrect = Number.isFinite(numericAnswer) && numericAnswer === lobby.currentQuestion.answer;

    if (isCorrect) {
      const player = lobby.players.get(socket.id);
      player.score += 10;
    }

    lobby.answers.set(socket.id, {
      id: socket.id,
      answer: numericAnswer,
      correct: isCorrect
    });

    socket.emit('answerResult', {
      correct: isCorrect,
      correctAnswer: lobby.currentQuestion.answer
    });

    if (lobby.answers.size === lobby.players.size) {
      io.to(lobby.code).emit('roundResults', {
        round: lobby.round,
        correctAnswer: lobby.currentQuestion.answer,
        players: Array.from(lobby.players.values()).sort((a, b) => b.score - a.score)
      });

      setTimeout(() => startNextRound(lobby), 2000);
    }
  });

  socket.on('setDifficulty', ({ code, difficulty }) => {
    const lobby = lobbies.get((code || '').toUpperCase());
    if (!lobby) {
      socket.emit('errorMessage', 'Lobby not found');
      return;
    }

    if (socket.id !== lobby.hostId) {
      socket.emit('errorMessage', 'Only the host can change difficulty');
      return;
    }

    lobby.difficulty = difficulty || 'easy';
    emitLobbyState(lobby);
  });

  socket.on('disconnect', () => {
    lobbies.forEach((lobby, code) => {
      if (lobby.players.has(socket.id)) {
        lobby.players.delete(socket.id);
        lobby.answers.delete(socket.id);

        if (lobby.hostId === socket.id) {
          const [nextHostId] = lobby.players.keys();
          lobby.hostId = nextHostId;
          if (nextHostId) {
            io.to(nextHostId).emit('hostPromotion', true);
          }
        }

        if (lobby.players.size === 0) {
          lobbies.delete(code);
        } else {
          emitLobbyState(lobby);
        }
      }
    });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});
