import { depositSync } from './services';

async function start(): Promise<void> {
  await depositSync.init();
}

export default {
  start,
};
