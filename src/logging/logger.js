'use strict';

const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'trace'];

const LEVEL_SEVERITY = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

function toLogLevel(value, fallback = 'info') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!LOG_LEVELS.includes(normalized)) {
    return fallback;
  }

  return normalized;
}

function defaultWrite(level, message) {
  const line = `${message}\n`;
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line);
    return;
  }

  process.stdout.write(line);
}

function inferLevelFromMessage(message) {
  const normalizedMessage = typeof message === 'string' ? message : String(message);

  if (/\[concurrency\]/i.test(normalizedMessage)) {
    return 'error';
  }

  if (/\[[^\]]*diag\]|\[normalizeship\]/i.test(normalizedMessage)) {
    return 'debug';
  }

  if (/\btrace\b/i.test(normalizedMessage)) {
    return 'trace';
  }

  if (/\bwarn(?:ing)?\b/i.test(normalizedMessage)) {
    return 'warn';
  }

  if (/\berror\b|\bfailed\b|\bfailure\b|\bfatal\b/i.test(normalizedMessage)) {
    return 'error';
  }

  if (/\bdebug\b/i.test(normalizedMessage)) {
    return 'debug';
  }

  return 'info';
}

function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

function createLogger(options = {}) {
  const configuredLevel = toLogLevel(
    options.minLevel || process.env.LOG_LEVEL || options.defaultLevel,
    'info'
  );
  const minSeverity = LEVEL_SEVERITY[configuredLevel];
  const write = typeof options.write === 'function' ? options.write : defaultWrite;

  const logWithLevel = (level, message, logOptions = {}) => {
    const levelFromOptions = toLogLevel(logOptions.level, null);
    const normalizedLevel = toLogLevel(levelFromOptions || level || inferLevelFromMessage(message));
    const severity = LEVEL_SEVERITY[normalizedLevel];

    if (severity > minSeverity) {
      return;
    }

    const normalizedMessage = typeof message === 'string' ? message : String(message);
    const formattedMessage = `${formatTimestamp()} ${normalizedMessage}`;
    write(normalizedLevel, formattedMessage, logOptions);
  };

  return {
    minLevel: configuredLevel,
    log(message, logOptions = {}) {
      logWithLevel(logOptions.level, message, logOptions);
    },
    error(message, logOptions = {}) {
      logWithLevel('error', message, logOptions);
    },
    warn(message, logOptions = {}) {
      logWithLevel('warn', message, logOptions);
    },
    info(message, logOptions = {}) {
      logWithLevel('info', message, logOptions);
    },
    debug(message, logOptions = {}) {
      logWithLevel('debug', message, logOptions);
    },
    trace(message, logOptions = {}) {
      logWithLevel('trace', message, logOptions);
    },
  };
}

module.exports = {
  createLogger,
  LOG_LEVELS,
  toLogLevel,
};