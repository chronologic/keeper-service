import { ENABLED } from './env';
import { createConnection } from 'keeper-db';
import { createLogger } from './logger';
import manager from './manager';

const logger = createLogger('server');

if (ENABLED) {
  createConnection().then(() => {
    logger.info('Service started');
    manager.start();
  });
} else {
  logger.warn('Service disabled');
}
