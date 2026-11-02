'use strict';

const { STAR_LIST_RESPONSE_EVENT } = require('../model/star-list');
const { getStarCatalogEntries } = require('../model/star-catalog');
const { attachRequestId } = require('./handler-utils');
const {
  compareIds,
  compareNames,
  compareNullableNumbers,
  emptyPage,
  pageItems,
  parsePaging,
} = require('./list-paging');

const VALID_SORTS = new Set(['distance', 'name']);

function toFiniteNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function starSortName(star) {
  return star.properName || star.catalogName || star.starId;
}

const SORTERS = {
  distance: (a, b) =>
    compareNullableNumbers(a.distanceParsec, b.distanceParsec) || compareIds(a.starId, b.starId),
  name: (a, b) => compareNames(starSortName(a), starSortName(b)) || compareIds(a.starId, b.starId),
};

class StarListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    const paging = parsePaging(payload);
    const fail = (message, playerName) =>
      attachRequestId(
        { success: false, message, playerName, stars: [], ...emptyPage(paging) },
        payload
      );

    const playerName = this.context.toNonEmptyString(payload?.playerName);
    if (!playerName) {
      return fail('playerName is required', playerName);
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return fail('Player is not registered', playerName);
    }
    if (!paging.ok) {
      return fail(paging.message, player.playerName);
    }
    const sort = this.context.toNonEmptyString(payload?.sort).toLowerCase() || 'distance';
    if (!VALID_SORTS.has(sort)) {
      return fail(`sort must be one of: ${[...VALID_SORTS].join(', ')}`, player.playerName);
    }
    const minDistance = toFiniteNumberOrNull(payload?.minDistanceParsec);
    const maxDistance = toFiniteNumberOrNull(payload?.maxDistanceParsec);
    if (minDistance !== null && maxDistance !== null && minDistance > maxDistance) {
      return fail('minDistanceParsec must not exceed maxDistanceParsec', player.playerName);
    }

    let stars = getStarCatalogEntries().slice();
    const systemId = this.context.toNonEmptyString(payload?.systemId).toLowerCase();
    if (systemId) stars = stars.filter((star) => star.systemId === systemId);
    const spectralClass = this.context.toNonEmptyString(payload?.spectralClass).toUpperCase();
    if (spectralClass) stars = stars.filter((star) => star.spectralClass === spectralClass);
    if (minDistance !== null) {
      stars = stars.filter(
        (star) => star.distanceParsec !== null && star.distanceParsec >= minDistance
      );
    }
    if (maxDistance !== null) {
      stars = stars.filter(
        (star) => star.distanceParsec !== null && star.distanceParsec <= maxDistance
      );
    }
    stars.sort(SORTERS[sort]);
    const { items, page } = pageItems(stars, paging);

    return attachRequestId(
      {
        success: true,
        message: items.length ? 'Star list retrieved successfully' : 'No stars matched the query',
        playerName: player.playerName,
        stars: items,
        ...page,
      },
      payload
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('star-list-request', payload);

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(STAR_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  StarListMessageHandler,
};
