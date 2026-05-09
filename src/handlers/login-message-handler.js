'use strict';

const { LOGIN_FAILURE_REASONS, LOGIN_RESPONSE_EVENT } = require('../model/login');

class LoginMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate required credentials and build immediate failure response when missing.
   * @param {Object} payload
   * @returns {Object|null}
   */
  buildMissingCredentialsResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const password = this.context.toNonEmptyString(payload?.password);

    if (!playerName || !password) {
      return {
        success: false,
        message: 'playerName and password are required',
        reason: LOGIN_FAILURE_REASONS.UNKNOWN,
      };
    }

    return null;
  }

  /**
   * @returns {{ success: boolean, message: string, reason: string }}
   */
  buildUnknownPlayerResponse() {
    return {
      success: false,
      message: 'Player is not registered',
      reason: LOGIN_FAILURE_REASONS.PLAYER_NOT_REGISTERED,
    };
  }

  /**
   * @returns {{ success: boolean, message: string, reason: string }}
   */
  buildPasswordMismatchResponse() {
    return {
      success: false,
      message: 'Password does not match',
      reason: LOGIN_FAILURE_REASONS.PASSWORD_MISMATCH,
    };
  }

  /**
   * Authenticate player, rotate session, and emit login-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('login', payload);

    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const password = this.context.toNonEmptyString(payload?.password);
    const hasLocale = payload != null && Object.prototype.hasOwnProperty.call(payload, 'locale');
    const preferredLocale = hasLocale ? this.context.normalizeLocale(payload?.locale) : null;

    const missingCredentials = this.buildMissingCredentialsResponse(payload);
    if (missingCredentials) {
      socket.emit(LOGIN_RESPONSE_EVENT, missingCredentials);
      return missingCredentials;
    }

    let player = this.context.getPlayer(playerName);
    if (!player) {
      // Reload from persistence so login works after process restarts.
      await this.context.getPlayerAsync(playerName);
      player = this.context.getPlayer(playerName);
    }

    if (!player) {
      const response = this.buildUnknownPlayerResponse();
      socket.emit(LOGIN_RESPONSE_EVENT, response);
      return response;
    }

    /** @type {any} */
    let response;
    if (player.password !== password) {
      response = this.buildPasswordMismatchResponse();
    } else {
      const sessionKey = this.context.createId();
      player.sessionKey = sessionKey;
      response = {
        success: true,
        message: 'Login successful',
        playerId: player.playerId,
        sessionKey,
      };
    }

    if (response.success) {
      try {
        player.socketId = socket.id;
        const updates = {
          sessionKey: response.sessionKey,
          socketId: socket.id,
        };
        if (hasLocale) {
          updates.preferredLocale = preferredLocale;
        }

        await this.context.updatePlayerAsync(playerName, {
          ...updates,
        });

        // Refresh character cache from persistence so character flows work after restarts.
        await this.context.getCharactersAsync(playerName);
      } catch (error) {
        this.context.log(`[login-handler] Failed to update player session: ${error.message}`);
        response.success = false;
        response.message = 'Login failed: database error';
        response.reason = LOGIN_FAILURE_REASONS.UNKNOWN;
        delete response.playerId;
        delete response.sessionKey;
      }
    }

    socket.emit(LOGIN_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  LoginMessageHandler,
};
