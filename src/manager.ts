import { ethClient } from './clients';
import { keepContractAt, tbtcSystem } from './contracts';
import { depositSync, depositMonitor, redeemer } from './services';

// keepContractAt('0x451946b16651c6d69a2c5d9e5848b31739d39eaa').getSignatureSubmittedEvent(8593300).then(console.log);

async function start(): Promise<void> {
  // await depositSync.init();
  // await depositMonitor.init();
  await redeemer.init();
}

export default {
  start,
};
