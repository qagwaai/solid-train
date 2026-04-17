'use strict';

const {
  LOGIN_FAILURE_REASONS,
  LOGIN_RESPONSE_EVENT
} = require('../model/login');

class LoginMessageHandler {
  constructor(context) {
    this.context = context;
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const password = this.context.toNonEmptyString(payload?.password);

    if (!playerName || !password) {
      return {
        success: false,
        message: 'playerName and password are required',
        reason: LOGIN_FAILURE_REASONS.UNKNOWN
      };
    }

    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        reason: LOGIN_FAILURE_REASONS.PLAYER_NOT_REGISTERED
      };
    }

    if (player.password !== password) {
      return {
        success: false,
        message: 'Password does not match',
        reason: LOGIN_FAILURE_REASONS.PASSWORD_MISMATCH
      };
    }

    const sessionKey = this.context.createId();
    player.sessionKey = sessionKey;

    return {
      success: true,
      message: 'Login successful',
      playerId: player.playerId,
      sessionKey
    };
  }

  handle(socket, payload) {
    this.context.logHandlerMessage('login', payload);

    const response = this.buildResponse(payload);

    if (response.success) {
      const player = this.context.getPlayer(payload?.playerName);
      if (player) {
        player.socketId = socket.id;
      }
    }

    socket.emit(LOGIN_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  LoginMessageHandler
};