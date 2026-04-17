'use strict';

const GAME_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

class GameState {
  constructor(options = {}) {
    this.id = options.id || 'default-game';
    this.idleTimeoutMs = options.idleTimeoutMs || GAME_IDLE_TIMEOUT_MS;
    this.participants = new Map();
  }

  static buildParticipantKey(normalizedPlayerName, characterId) {
    return `${normalizedPlayerName}:${characterId}`;
  }

  joinCharacter({
    playerName,
    normalizedPlayerName,
    characterId,
    characterName,
    timestamp
  }) {
    const key = GameState.buildParticipantKey(normalizedPlayerName, characterId);
    const existing = this.participants.get(key);
    const joinedAt = existing ? existing.joinedAt : timestamp;

    const participant = {
      playerName,
      normalizedPlayerName,
      characterId,
      characterName,
      joinedAt,
      lastMessageReceivedAt: timestamp
    };

    this.participants.set(key, participant);
    return { ...participant };
  }

  updateCharacterName({ normalizedPlayerName, characterId, characterName }) {
    const key = GameState.buildParticipantKey(normalizedPlayerName, characterId);
    const participant = this.participants.get(key);

    if (!participant) {
      return null;
    }

    participant.characterName = characterName;
    return { ...participant };
  }

  touchParticipants({ normalizedPlayerName, characterId, timestamp }) {
    const touched = [];

    for (const participant of this.participants.values()) {
      const isSamePlayer = participant.normalizedPlayerName === normalizedPlayerName;
      if (!isSamePlayer) {
        continue;
      }

      const matchesCharacter = !characterId || participant.characterId === characterId;
      if (!matchesCharacter) {
        continue;
      }

      participant.lastMessageReceivedAt = timestamp;
      touched.push({ ...participant });
    }

    return touched;
  }

  detachCharacter({ normalizedPlayerName, characterId }) {
    const key = GameState.buildParticipantKey(normalizedPlayerName, characterId);
    const participant = this.participants.get(key);

    if (!participant) {
      return null;
    }

    this.participants.delete(key);
    return { ...participant };
  }

  detachIdleCharacters(timestamp) {
    const now = Date.parse(timestamp);
    if (Number.isNaN(now)) {
      return [];
    }

    const cutoff = now - this.idleTimeoutMs;
    const detached = [];

    for (const [key, participant] of this.participants.entries()) {
      const lastMessage = Date.parse(participant.lastMessageReceivedAt);
      if (Number.isNaN(lastMessage)) {
        continue;
      }

      if (lastMessage <= cutoff) {
        this.participants.delete(key);
        detached.push({ ...participant });
      }
    }

    return detached;
  }

  getParticipant({ normalizedPlayerName, characterId }) {
    const key = GameState.buildParticipantKey(normalizedPlayerName, characterId);
    const participant = this.participants.get(key);
    return participant ? { ...participant } : null;
  }

  getAllParticipants() {
    return Array.from(this.participants.values(), (participant) => ({
      ...participant
    }));
  }
}

module.exports = {
  GAME_IDLE_TIMEOUT_MS,
  GameState
};