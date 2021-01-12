import { depositSync, depositMonitor } from './services';

async function start(): Promise<void> {
  // await depositSync.init();
  await depositMonitor.init();
}

export default {
  start,
};
