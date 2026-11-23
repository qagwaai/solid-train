'use strict';

class SharedGameClock {
  constructor(options = {}) {
    this.startedAtWallMs = options.startedAtWallMs ?? Date.now();
    this.epochMs = options.epochMs ?? this.startedAtWallMs;
    this.lastWallMs = this.startedAtWallMs;
    this.running = options.running !== false;
    this.generation = options.generation ?? 1;
    this.lineage = options.lineage ?? 'navigation-clock-lineage-v1';
    this.databaseService = options.databaseService || null;
    this.initialized = options.initialized === true;
    this.lastCheckpointWallMs = this.lastWallMs;
  }

  async initializeAsync(databaseService = this.databaseService) {
    this.databaseService = databaseService || null;
    if (!this.databaseService) {
      this.initialized = false;
      return this.read();
    }
    const wallMs = Date.now();
    let persisted;
    try {
      persisted = await this.databaseService.getNavigationGameClock();
    } catch (_error) {
      this.initialized = false;
      return this.read();
    }
    if (persisted) {
      if (
        persisted.lineage !== this.lineage ||
        !Number.isSafeInteger(persisted.epochMs) ||
        !Number.isSafeInteger(persisted.generation) ||
        typeof persisted.running !== 'boolean'
      ) {
        this.initialized = false;
        return this.read();
      }
      this.epochMs = persisted.epochMs;
      this.running = persisted.running;
      this.generation = persisted.generation;
      this.lastWallMs = wallMs;
      this.lastCheckpointWallMs = wallMs;
      if (this.running) {
        const stoppedAtWallMs =
          Number.isSafeInteger(persisted.stoppedAtWallMs) ? persisted.stoppedAtWallMs : null;
        if (stoppedAtWallMs !== null) {
          // A clean stopped state resumes without stopped-server downtime.
          this.running = true;
        }
      }
    } else {
      this.epochMs = wallMs;
      this.running = true;
      this.lastWallMs = wallMs;
      this.lastCheckpointWallMs = wallMs;
      this.generation = 1;
      await this.persistAsync();
    }
    this.initialized = true;
    await this.persistAsync();
    return this.read();
  }

  read() {
    if (!this.initialized) {
      return {
        status: 'unavailable',
        epochMs: null,
        timeScaleId: 'stellar:unix-ms-uniform:v1',
        running: false,
        generation: this.generation,
        lineage: this.lineage,
        durability: 'process-only-unverified',
      };
    }
    this.advance(Date.now());
    return {
      status: 'supported',
      epochMs: this.epochMs,
      timeScaleId: 'stellar:unix-ms-uniform:v1',
      running: this.running,
      generation: this.generation,
      lineage: this.lineage,
      durability: 'durable-mongo-game-state',
    };
  }

  advance(wallMs) {
    if (!Number.isFinite(wallMs)) return;
    const elapsed = Math.max(0, wallMs - this.lastWallMs);
    if (this.running) this.epochMs += elapsed;
    this.lastWallMs = wallMs;
  }

  async persistAsync() {
    if (!this.databaseService) return false;
    const wallMs = Date.now();
    this.advance(wallMs);
    try {
      await this.databaseService.putNavigationGameClock({
        lineage: this.lineage,
        epochMs: this.epochMs,
        running: this.running,
        generation: this.generation,
        lastWallMs: wallMs,
        stoppedAtWallMs: this.running ? null : wallMs,
        updatedAtWallMs: wallMs,
      });
      this.lastCheckpointWallMs = wallMs;
      return true;
    } catch (_error) {
      this.initialized = false;
      return false;
    }
  }

  async pause() {
    this.advance(Date.now());
    this.running = false;
    await this.persistAsync();
  }

  async resume() {
    this.advance(Date.now());
    this.running = true;
    await this.persistAsync();
  }
}

module.exports = { SharedGameClock };
