import './env';
import { createConnection } from 'typeorm';
import logger from './logger';
import manager from './manager';

createConnection().then(() => {
  logger.log('\x1b[36m%s\x1b[0m', 'Server started');
  manager.start();
});
