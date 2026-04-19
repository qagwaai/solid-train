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

    return {
      success: true,
      message: 'Registration successful'
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('register', payload);

    const response = this.buildResponse(payload);

    if (response.success) {
      const playerName = this.context.toNonEmptyString(payload?.playerName);
      const email = this.context.toNonEmptyString(payload?.email);
      const password = this.context.toNonEmptyString(payload?.password);

      const playerData = {
        playerId: this.context.createId(),
        playerName,
        email,
        password
      };

      try {
        const existingPlayer = await this.context.getPlayerAsync(playerName);
        if (existingPlayer) {
          response.success = false;
          response.message = 'playerName already exists';
          socket.emit(REGISTER_RESPONSE_EVENT, response);
          return response;
        }

        await this.context.registerPlayerAsync(playerData);
        response.playerId = playerData.playerId;

        const player = this.context.getPlayer(payload?.playerName);
        if (player) {
          await this.context.updatePlayerAsync(player.playerName, {
            socketId: socket.id
          });
        }
      } catch (error) {
        if (error?.message === 'Player already exists') {
          response.success = false;
          response.message = 'playerName already exists';
        } else {
          this.context.log(`[register-handler] Failed to register player: ${error.message}`);
          response.success = false;
          response.message = 'Registration failed: database error';
        }
        delete response.playerId;
      }
    }

    socket.emit(REGISTER_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  RegisterMessageHandler
};