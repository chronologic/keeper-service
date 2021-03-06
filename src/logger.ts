/* eslint-disable no-console */
import { createLogger as createWinstonLogger, format, transports, LeveledLogMethod } from 'winston';

import { LOG_LEVEL } from './env';

interface ICustomLogger {
  error: LeveledLogMethod;
  warn: LeveledLogMethod;
  info: LeveledLogMethod;
  debug: LeveledLogMethod;
}

// normally, winston transports catch all log levels up to a given level
// meaning e.g. info transport catches debug messages too, resulting in multiple messages for the same thing
// separate instances per log level solve that issue
// see: https://github.com/winstonjs/winston/issues/614
export function createLogger(source: string): ICustomLogger {
  const errorLogger = createWinstonLogger({
    format: format.combine(
      format.errors({ stack: true }),
      format.colorize(),
      format.timestamp(),
      format.printf(
        ({ level, message, timestamp, stack = '' }) => `${timestamp} ${level} [${source}] ${message} ${stack}`
      )
    ),
    transports: [new transports.Console()],
    defaultMeta: { source },
    level: LOG_LEVEL,
  });

  const createNonErrorLogger = () =>
    createWinstonLogger({
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ level, message, timestamp, ...rest }) => {
          const formattedMessage = typeof message === 'object' ? JSON.stringify(message) : message;
          const extra = rest[Symbol.for('splat') as any];
          const formattedExtra = extra ? JSON.stringify(extra) : '';

          return `${timestamp} ${level} [${source}] ${formattedMessage} ${formattedExtra}`;
        })
      ),
      transports: [new transports.Console()],
      defaultMeta: { source },
      level: LOG_LEVEL,
    });

  const warnLogger = createNonErrorLogger();
  const infoLogger = createNonErrorLogger();
  const debugLogger = createNonErrorLogger();

  return {
    error: errorLogger.error.bind(errorLogger),
    warn: warnLogger.warn.bind(warnLogger),
    info: infoLogger.info.bind(infoLogger),
    debug: debugLogger.debug.bind(debugLogger),
  };
}

const logger = createLogger('logger');

// override console to suppress logging from dependency libs that use it
// logs will still go through in 'debug' mode
console.log = logger.debug;
console.info = logger.debug;
console.warn = logger.debug;
console.error = logger.debug;

export default logger;
