# solid-train

Simple Socket.IO server with Node.js.

## Requirements

- Node.js 20+

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

The server listens on port `3000` by default. Set `PORT` to override.

## Endpoints

- `GET /` - basic status text
- `GET /health` - JSON health response

## Socket.IO events

- `welcome` (server -> client): sent on connection
- `message` (client -> server): broadcasts to all clients as `message`

## Test

```bash
npm test
```
