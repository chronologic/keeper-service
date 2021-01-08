import { createConnection } from 'typeorm';

import './env';
import logger from './logger';

createConnection().then(() => {
  logger.log('\x1b[36m%s\x1b[0m', `Server started`);
});
