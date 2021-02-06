import './env';
import { createConnection } from 'keeper-db';
import { createLogger } from './logger';
import manager from './manager';

const logger = createLogger('server');

createConnection().then(() => {
  logger.info('Server started');
  manager.start();
});
