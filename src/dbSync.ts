import './env';
import { createConnection } from 'typeorm';
import logger from './logger';

createConnection().then(() => {
  logger.info('DB schema synchronized');
});
