import { Event } from 'ethers';
import { getConnection, Deposit } from 'keeper-db';

import { SYNC_MIN_BLOCK, DEPOSIT_SYNC_INTERVAL_MINUTES } from '../env';
import { createLogger } from '../logger';
import { bnToNumberBtc } from '../utils';
import { tbtcSystem } from '../contracts';
import { MINUTE_MILLIS } from '../constants';
import depositHelper from './depositHelper';

const logger = createLogger('depositSync');
const SYNC_INTERVAL = DEPOSIT_SYNC_INTERVAL_MINUTES * MINUTE_MILLIS;

async function init(): Promise<void> {
  if (SYNC_INTERVAL > 0) {
    await syncPeriodically();
  } else {
    logger.warn('Syncing deposits disabled');
  }
}

async function syncPeriodically(): Promise<void> {
  try {
    await syncDepositsFromLogs();
  } catch (e) {
    logger.error(e);
  }
  logger.info(`Next run in ${DEPOSIT_SYNC_INTERVAL_MINUTES} minutes`);
  setTimeout(syncPeriodically, SYNC_INTERVAL);
}

async function syncDepositsFromLogs(): Promise<void> {
  const events = await findNewDeposits();

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

async function findNewDeposits(): Promise<Event[]> {
  const lastSyncedBlockNumber = await getLastSyncedBlockNumber();
  logger.info(`🚀 syncing deposits from logs starting from block ${lastSyncedBlockNumber}...`);
  const events = await tbtcSystem.contract.queryFilter(tbtcSystem.contract.filters.Funded(), lastSyncedBlockNumber);
  const lastSyncedDeposits = await getDepositsForBlockNumber(lastSyncedBlockNumber);

  const newEvents = events.filter(
    (e) =>
      !lastSyncedDeposits.find((d) => {
        const parsed = tbtcSystem.contract.interface.parseLog(e);
        const [depositAddress]: [string] = parsed.args as any;

        return d.depositAddress.toLowerCase() === depositAddress.toLowerCase();
      })
  );

  return newEvents;
}

async function getDepositsForBlockNumber(blockNumber: number): Promise<Deposit[]> {
  const deposit = await getConnection().createEntityManager().find(Deposit, {
    where: { blockNumber },
  });

  return deposit;
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
  let deposit = await depositHelper.build(depositAddress, event.blockNumber);
  let stored = false;
  const acceptedStatuses = [Deposit.Status.ACTIVE, Deposit.Status.COURTESY_CALL];

  if (acceptedStatuses.includes(deposit.statusCode)) {
    deposit = await depositHelper.store(deposit);
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
