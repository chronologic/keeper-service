import './env';
import { createConnection } from 'typeorm';
import { createLogger } from './logger';
import manager from './manager';

const logger = createLogger('server');

createConnection().then(() => {
  logger.info('Server started');
  manager.start();
});
