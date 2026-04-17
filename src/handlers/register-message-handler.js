'use strict';

const { REGISTER_RESPONSE_EVENT } = require('../model/register');

class RegisterMessageHandler {
  constructor(context) {
    this.context = context;
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const email = this.context.toNonEmptyString(payload?.email);
    const password = this.context.toNonEmptyString(payload?.password);

    if (!playerName || !email || !password) {
      return {
        success: false,
        message: 'playerName, email, and password are required'
      };
    }

    const normalizedPlayerName = playerName.toLowerCase();
    if (this.context.registeredPlayers.has(normalizedPlayerName)) {
      return {
        success: false,
        message: 'playerName already exists'
      };
    }

    const playerId = this.context.createId();
    this.context.registeredPlayers.set(normalizedPlayerName, {
      playerId,
      playerName,
      email,
      password,
      sessionKey: null,
      socketId: null
    });
    this.context.setCharacters(normalizedPlayerName, []);

    return {
      success: true,
      message: 'Registration successful',
      playerId
    };
  }

  handle(socket, payload) {
    const response = this.buildResponse(payload);

    if (response.success) {
      const player = this.context.getPlayer(payload?.playerName);
      if (player) {
        player.socketId = socket.id;
      }
    }

    socket.emit(REGISTER_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  RegisterMessageHandler
};