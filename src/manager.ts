import { ethClient } from './clients';
import { depositSync, depositMonitor, redemption } from './services';

async function start(): Promise<void> {
  // await depositSync.init();
  // await depositMonitor.init();
  // await redemption.init();
}

export default {
  start,
};
