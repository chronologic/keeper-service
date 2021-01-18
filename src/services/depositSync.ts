import { ethers, Event } from 'ethers';
import { getConnection } from 'typeorm';

import { Deposit } from '../entities/Deposit';
import { Operator } from '../entities/Operator';
import { DEPOSIT_SYNC_MIN_BLOCK } from '../env';
import { createLogger } from '../logger';
import { DepositStatus } from '../types';
import { bnToNumberBtc } from '../utils';
import { tbtcSystem, depositContractAt, keepContractAt } from '../contracts';
import TBTCSystemABI from '../abi/TBTCSystem.json';
import { ethClient } from '../clients';

const logger = createLogger('depositSync');

async function init(): Promise<void> {
  await listenForNewDeposists();
  // listenForDepositStateChanges();
  await syncDepositsFromLogs();
}

async function listenForNewDeposists(): Promise<void> {
  const tbtcSystemContract = await tbtcSystem.getContract();
  tbtcSystemContract.on('Funded', async (...args) => {
    const [_d, _tx, _t, event] = args;
    logger.info(`⭐ new Funded event at block ${event.blockNumber}`);
    await mapAndMaybeStoreFundedEvent(event);
  });
}

async function listenForDepositStateChanges(): Promise<void> {
  const tbtcSystemContract = await tbtcSystem.getContract();
  tbtcSystemContract.on('Funded', async (...args) => {
    console.log('Funded', args);
    // const [_a, _m, _k, _o, _n, event] = args;
    // logger.info(`⭐ new Funded event at block ${event.blockNumber}`);
    // const deposit = await mapAndMaybeStoreFundedEvent(event);
    // logger.info(`✅ stored deposit ${deposit.depositAddress}`);
  });
  tbtcSystemContract.on('RedemptionRequested', async (...args) => {
    console.log('RedemptionRequested', args);
    // const [_a, _m, _k, _o, _n, event] = args;
    // logger.info(`⭐ new Funded event at block ${event.blockNumber}`);
    // const deposit = await mapAndMaybeStoreFundedEvent(event);
    // logger.info(`✅ stored deposit ${deposit.depositAddress}`);
  });
  tbtcSystemContract.on('Redeemed', async (...args) => {
    console.log('Redeemed', args);
    // const [_a, _m, _k, _o, _n, event] = args;
    // logger.info(`⭐ new Funded event at block ${event.blockNumber}`);
    // const deposit = await mapAndMaybeStoreFundedEvent(event);
    // logger.info(`✅ stored deposit ${deposit.depositAddress}`);
  });
}

async function syncDepositsFromLogs(): Promise<void> {
  const lastSyncedBlockNumber = await getLastSyncedBlockNumber();
  const tbtcSystemContract = await tbtcSystem.getContract();
  logger.info(`🚀 syncing deposits from logs starting from block ${lastSyncedBlockNumber}...`);
  const events = await tbtcSystemContract.queryFilter(tbtcSystemContract.filters.Funded(), lastSyncedBlockNumber);

  logger.info(`ℹ found ${events.length} events, syncing...`);

  let storedCount = 0;
  let skippedCount = 0;

  for (const event of events) {
    const stored = await mapAndMaybeStoreFundedEvent(event);
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

  return max || DEPOSIT_SYNC_MIN_BLOCK;
}

async function mapAndMaybeStoreFundedEvent(event: Event): Promise<boolean> {
  let deposit = await mapFundedEventToDeposit(event);
  let stored = false;
  const acceptedStatuses = [DepositStatus.ACTIVE, DepositStatus.COURTESY_CALL];

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

async function mapFundedEventToDeposit(event: Event): Promise<Deposit> {
  const tbtcSystemContract = await tbtcSystem.getContract();
  const deposit = new Deposit();
  deposit.blockNumber = event.blockNumber;

  const parsed = tbtcSystemContract.interface.parseLog(event);
  const [depositAddress]: [string] = parsed.args as any;

  deposit.depositAddress = depositAddress.toLowerCase();
  const depositContract = depositContractAt(depositAddress);

  deposit.statusCode = await depositContract.getStatusCode();
  deposit.status = DepositStatus[deposit.statusCode];

  deposit.keepAddress = await depositContract.getKeepAddress();
  const keepContract = keepContractAt(deposit.keepAddress);

  deposit.bondedEth = await keepContract.getBondedEth();

  const createdAtTimestamp = await keepContract.getOpenedTimestamp();
  deposit.createdAt = new Date(createdAtTimestamp);

  deposit.lotSizeSatoshis = await depositContract.getLotSizeSatoshis();

  deposit.undercollateralizedThresholdPercent = await depositContract.getUndercollateralizedThresholdPercent();

  const operators = await keepContract.getMembers();

  deposit.operators = operators.map((o: string) => {
    const operator = new Operator();
    operator.address = o;
    return operator;
  });

  return deposit;
}

async function storeDeposit(deposit: Deposit): Promise<Deposit> {
  const connection = getConnection();
  const manager = connection.createEntityManager();
  // eslint-disable-next-line no-param-reassign
  deposit.operators = await Promise.all(deposit.operators.map(storeOperator));

  let depositDb = await manager.findOne(Deposit, {
    where: { depositAddress: deposit.depositAddress },
  });

  depositDb = (await manager.save(Deposit, { ...depositDb, ...deposit })) as Deposit;

  return depositDb;
}

async function storeOperator(operator: Operator): Promise<Operator> {
  const connection = getConnection();
  const manager = connection.createEntityManager();

  let operatorDb = await manager.findOne(Operator, {
    where: { address: operator.address },
  });

  if (operatorDb) {
    return operatorDb;
  }

  operatorDb = (await manager.save(Operator, operator)) as Operator;

  return operatorDb;
}

export default {
  init,
};
