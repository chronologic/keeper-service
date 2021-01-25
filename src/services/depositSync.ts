import { Event } from 'ethers';
import { getConnection } from 'typeorm';

import { Deposit } from '../entities/Deposit';
import { SYNC_MIN_BLOCK } from '../env';
import { createLogger } from '../logger';
import { DepositStatus } from '../types';
import { bnToNumberBtc } from '../utils';
import { tbtcSystem } from '../contracts';
import { buildDeposit, storeDeposit } from './depositHelper';

const logger = createLogger('depositSync');

async function init(): Promise<void> {
  await listenForNewDeposits();
  // listenForDepositStateChanges();
  await syncDepositsFromLogs();
}

async function listenForNewDeposits(): Promise<void> {
  tbtcSystem.contract.on('Funded', async (...args) => {
    const [, , , event] = args;
    console.log('FUNDED EVENT', args);
    logger.info(`⭐ new Funded event at block ${event.blockNumber}`);
    await maybeStoreDepositFundedEvent(event);
  });
}

async function syncDepositsFromLogs(): Promise<void> {
  const lastSyncedBlockNumber = await getLastSyncedBlockNumber();
  logger.info(`🚀 syncing deposits from logs starting from block ${lastSyncedBlockNumber}...`);
  const events = await tbtcSystem.contract.queryFilter(tbtcSystem.contract.filters.Funded(), lastSyncedBlockNumber);

  logger.info(`ℹ found ${events.length} events, syncing...`);

  let storedCount = 0;
  let skippedCount = 0;

  for (const event of events) {
    const stored = await maybeStoreDepositFundedEvent(event);
    if (stored) {
      storedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  logger.info(`🎉 syncing deposits from logs completed. stored ${storedCount}, skipped ${skippedCount}`);
}

async function getLastSyncedBlockNumber(): Promise<number> {
  const connection = getConnection();
  const [{ max }] = await connection
    .createQueryBuilder()
    .select('MAX("blockNumber") as max')
    .from(Deposit, 'd')
    .execute();
  logger.debug(`last synced block number: ${max}`);

  return max || SYNC_MIN_BLOCK;
}

async function maybeStoreDepositFundedEvent(event: Event): Promise<boolean> {
  const parsed = tbtcSystem.contract.interface.parseLog(event);
  const [depositAddress]: [string] = parsed.args as any;
  let deposit = await buildDeposit(depositAddress, event.blockNumber);
  let stored = false;
  const acceptedStatuses = [Deposit.Status.ACTIVE, Deposit.Status.COURTESY_CALL];

  if (acceptedStatuses.includes(deposit.statusCode)) {
    deposit = await storeDeposit(deposit);
    stored = true;
  }
  logger.info(
    `✅ ${stored ? 'stored' : 'skipped'} ${deposit.status} deposit ${deposit.depositAddress} ${bnToNumberBtc(
      deposit.lotSizeSatoshis,
      3
    )} BTC`
  );

  return stored;
}

export default {
  init,
};
