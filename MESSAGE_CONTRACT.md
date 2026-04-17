# Stellar Socket Message Contract

This document describes all Socket.IO message types handled by this server,
including required fields, response payloads, and edge-case behavior.

## General Behavior

- All message payload string fields are trimmed.
- Player lookup is case-insensitive by `playerName`.
- Character operations (`list`, `add`, `delete`, `edit`) require a valid session.
- Invalid or missing session for character operations emits:
  - event: `invalid-session`
  - payload: `{ "message": "Invalid session" }`
- Validation failures return response events with `success: false` and a message,
  except invalid session which uses `invalid-session` event.

## Event: `register`

- Request event: `register`
- Response event: `register-response`

### Request Payload

- `playerName` (required, non-empty string)
- `email` (required, non-empty string)
- `password` (required, non-empty string)

### Success Response

```json
{
  "success": true,
  "message": "Registration successful",
  "playerId": "<uuid>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName, email, and password are required"
}
```

- Duplicate `playerName` (case-insensitive):

```json
{
  "success": false,
  "message": "playerName already exists"
}
```

### Edge Cases

- `playerName` uniqueness is enforced case-insensitively.
- On successful register, an empty character list is initialized for the player.

## Event: `login`

- Request event: `login`
- Response event: `login-response`

### Request Payload

- `playerName` (required, non-empty string)
- `password` (required, non-empty string)

### Success Response

```json
{
  "success": true,
  "message": "Login successful",
  "playerId": "<uuid>",
  "sessionKey": "<uuid>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and password are required",
  "reason": "UNKNOWN"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "reason": "PLAYER_NOT_REGISTERED"
}
```

- Password mismatch:

```json
{
  "success": false,
  "message": "Password does not match",
  "reason": "PASSWORD_MISMATCH"
}
```

### Edge Cases

- Login regenerates a fresh `sessionKey` every successful login.
- `playerName` matching is case-insensitive.

## Event: `character-list-request`

- Request event: `character-list-request`
- Response event: `character-list-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required for valid list response)
- `sessionKey` (required and must match the player)

### Success Response

```json
{
  "success": true,
  "message": "Character list retrieved successfully",
  "playerName": "<canonical player name>",
  "characters": [
    {
      "id": "<character id>",
      "characterName": "<name>",
      "createdAt": "<iso timestamp>"
    }
  ]
}
```

### Failure and Edge Behavior

- Invalid session emits `invalid-session` instead of `character-list-response`.
- If session is valid but `playerName` is empty:

```json
{
  "success": false,
  "message": "playerName is required",
  "playerName": "",
  "characters": []
}
```

- If session is valid but player is not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<provided playerName>",
  "characters": []
}
```

### Edge Cases

- Returned `characters` array is a defensive copy of server state.

## Event: `character-add-request`

- Request event: `character-add-request`
- Response event: `character-add-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `characterName` (required)

### Success Response

```json
{
  "success": true,
  "message": "Character added successfully",
  "playerName": "<canonical player name>",
  "characterName": "<character name>",
  "characterId": "<uuid>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and characterName are required",
  "playerName": "<trimmed playerName or empty>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Added character stores `id`, `characterName`, and `createdAt`.

## Event: `character-delete-request`

- Request event: `character-delete-request`
- Response event: `character-delete-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `characterId` (required)

### Success Response

```json
{
  "success": true,
  "message": "Character deleted successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName and characterId are required",
  "playerName": "<trimmed playerName or empty>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>"
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Character removal is scoped to that player only.

## Event: `character-edit`

- Request event: `character-edit`
- Response event: `character-edit-response`
- Session failure event: `invalid-session`

### Request Payload

- `playerName` (required)
- `sessionKey` (required and must match the player)
- `characterId` (required)
- `characterName` (required)

### Success Response

```json
{
  "success": true,
  "message": "Character edited successfully",
  "playerName": "<canonical player name>",
  "characterId": "<character id>",
  "characterName": "<updated character name>"
}
```

### Failure Responses

- Missing required fields:

```json
{
  "success": false,
  "message": "playerName, characterId, and characterName are required",
  "playerName": "<trimmed playerName or empty>",
  "characterId": "<trimmed characterId or empty>"
}
```

- Player not registered:

```json
{
  "success": false,
  "message": "Player is not registered",
  "playerName": "<trimmed playerName>",
  "characterId": "<provided characterId>"
}
```

- Character not found in player list:

```json
{
  "success": false,
  "message": "Character is not in player list",
  "playerName": "<canonical player name>",
  "characterId": "<provided characterId>"
}
```

### Edge Cases

- Invalid session emits `invalid-session`.
- Edit mutates only the target player's character list entry.
- If character is missing, list is unchanged.

## Notes For Client Implementers

- Treat `invalid-session` as a top-level auth/session failure signal for all
  character operations.
- Use the response `playerName` value as the canonical casing from server state
  when present.
- For login failures, branch on `reason` in addition to `message`.