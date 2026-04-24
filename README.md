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
- `register` / `register-response`
- `login` / `login-response`
- `character-list-request` / `character-list-response`
- `character-add-request` / `character-add-response`
- `character-delete-request` / `character-delete-response`
- `character-edit` / `character-edit-response`
- `drone-list-request` / `drone-list-response`
- `game-join` / `game-join-response`
- `add-mission-request` / `add-mission-response`
- `list-missions-request` / `list-missions-response`
- `celestial-body-upsert-request` / `celestial-body-upsert-response`
- `celestial-body-list-request` / `celestial-body-list-response`
- `invalid-session` (server -> client): emitted when session validation fails

## Test

```bash
npm test
```
