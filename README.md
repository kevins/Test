# Math Arena

A real-time multiplayer math challenge built with Node.js, Express, Socket.IO, and a mobile-friendly web interface. Players can host or join lobbies, compete to answer math prompts, and track scores on a live leaderboard.

## Project Structure

```
Test/
├── server/   # Express + Socket.IO backend
└── client/   # Responsive browser client served with lite-server
```

## Features

- Lobby creation with shareable 5-character room codes
- Real-time player synchronization and score tracking
- Adjustable difficulty (easy/medium/hard) controlled by the host
- Automatic round progression through 10 math prompts
- Mobile-first UI that works across multiple simultaneous clients

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- npm (bundled with Node.js)

## Setup

Install dependencies for both the server and the client:

```bash
cd server
npm install

cd ../client
npm install
```

> **Note:** The repository does not include `node_modules`. Run `npm install` in each directory on a machine with npm registry access.

## Running the Application

### 1. Start the server

```bash
cd server
npm run start
```

The server listens on port **4000** by default. You can change the port with the `PORT` environment variable.

### 2. Launch the web client

In a new terminal:

```bash
cd client
npm run start
```

The client runs on port **3000** via `lite-server`. It serves static assets and hot-reloads changes during development.

### 3. Connect from devices

- On desktop: open [http://localhost:3000](http://localhost:3000).
- On mobile devices connected to the same network, use the host machine's LAN IP. For example: `http://192.168.1.50:3000/?server=http://192.168.1.50:4000`.
  - The `server` query parameter allows pointing the client to the correct Socket.IO endpoint when not running on localhost.

## Gameplay Flow

1. A player hosts a lobby from the "Host a Lobby" form and shares the generated room code.
2. Other players join using the room code from the "Join a Lobby" form.
3. Once everyone is ready, the host starts the game. Math prompts appear simultaneously for all players.
4. Players submit answers from their devices. Correct answers earn 10 points.
5. After each round, the leaderboard updates. After 10 rounds, final results are displayed.

## Additional Configuration

- **Round Limit:** Override the default 10 rounds by exporting `ROUND_LIMIT` when starting the server (e.g., `ROUND_LIMIT=5 npm run start`).
- **CORS:** Socket.IO is configured to accept connections from any origin for easier local development. Adjust in `server/src/server.js` for production.

## License

This project is released under the MIT License. See the [LICENSE](LICENSE) file for details.
