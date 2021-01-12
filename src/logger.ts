import { createLogger as createWinstonLogger, format, Logger, transports } from 'winston';

const logTransports = [
  new transports.File({
    level: 'error',
    filename: './logs/error.log',
    format: format.json({
      replacer: (key, value) => {
        if (key === 'error') {
          return {
            message: (value as Error).message,
            stack: (value as Error).stack,
          };
        }
        return value;
      },
    }),
  }),
  new transports.Console({
    level: 'debug',
    format: format.prettyPrint(),
  }),
  new transports.Console({
    level: 'info',
    format: format.simple(),
  }),
];

export function createLogger(serviceName: string): Logger {
  return createWinstonLogger({
    format: format.combine(format.timestamp()),
    transports: logTransports,
    defaultMeta: { service: serviceName },
  });
}

const logger = createLogger('service');

export default logger;
