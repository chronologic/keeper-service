import { ethers, Event } from 'ethers';
import { getConnection } from 'typeorm';

import { Deposit } from '../entities/Deposit';
import { Operator } from '../entities/Operator';
import { DEPOSIT_SYNC_MIN_BLOCK } from '../env';
import { createLogger } from '../logger';
import { DepositStatus } from '../types';
import { bnToNumberBtc } from '../utils/bnToNumber';
import { bondedEcdsaKeepContractAt, depositContractAt, tbtcSystemContract } from './ethClient';

const logger = createLogger('depositSync');

async function init(): Promise<void> {
  listenForNewDeposists();
  // listenForDepositStateChanges();
  await syncDepositsFromLogs();
}

function listenForNewDeposists(): void {
  tbtcSystemContract.on('Funded', async (...args) => {
    const [_d, _tx, _t, event] = args;
    logger.info(`⭐ new Funded event at block ${event.blockNumber}`);
    await mapAndMaybeStoreFundedEvent(event);
  });
}

function listenForDepositStateChanges(): void {
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

async function syncDepositsFromLogs() {
  const lastSyncedBlockNumber = await getLastSyncedBlockNumber();
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
  const deposit = new Deposit();
  deposit.blockNumber = event.blockNumber;

  const parsed = tbtcSystemContract.interface.parseLog(event);
  const [depositAddress]: [string] = parsed.args as any;

  deposit.depositAddress = depositAddress.toLowerCase();
  const depositContract = depositContractAt(depositAddress);

  const [statusCodeBn] = await depositContract.functions.currentState();
  deposit.statusCode = statusCodeBn.toNumber();
  deposit.status = DepositStatus[deposit.statusCode];

  const [keepAddress] = await depositContract.functions.keepAddress();
  deposit.keepAddress = keepAddress.toLowerCase();
  const keepContract = bondedEcdsaKeepContractAt(deposit.keepAddress);

  deposit.bondedEth = await keepContract.functions.checkBondAmount();

  const [createdAtBn] = await keepContract.functions.getOpenedTimestamp();
  const createdAtTimestamp = createdAtBn.toNumber() * 1000;
  deposit.createdAt = new Date(createdAtTimestamp);

  const [lotSizeSatoshisBn] = await depositContract.functions.lotSizeSatoshis();
  deposit.lotSizeSatoshis = lotSizeSatoshisBn;

  const [undercollateralizedThresholdPercent] = await depositContract.functions.undercollateralizedThresholdPercent();
  deposit.undercollateralizedThresholdPercent = undercollateralizedThresholdPercent;

  const [operators] = await keepContract.functions.getMembers();

  deposit.operators = operators.map((o: string) => {
    const operator = new Operator();
    operator.address = o.toLowerCase();
    return operator;
  });

  return deposit;
}

// async function mapBondedEcdsaKeepCreatedEventToDeposit(event: Event): Promise<Deposit> {
//   const deposit = new Deposit();
//   deposit.blockNumber = event.blockNumber;

//   const parsed = bondedEcdsaKeepFactoryContract.interface.parseLog(event);
//   const [keepAddress, operators, depositAddress]: [string, string[], string] = parsed.args as any;
//   deposit.depositAddress = depositAddress.toLowerCase();
//   deposit.keepAddress = keepAddress.toLowerCase();

//   const keepContract = bondedEcdsaKeepContractAt(keepAddress);
//   const depositContract = depositContractAt(depositAddress);

//   const [statusCodeBn] = await depositContract.functions.currentState();
//   const statusCode = statusCodeBn.toNumber();
//   deposit.status = DepositStatus[statusCode];

//   deposit.bondedEth = ethers.BigNumber.from('0');
//   if (statusCode <= DepositStatus.ACTIVE) {
//     const [bondedEth] = await keepContract.functions.checkBondAmount();
//     deposit.bondedEth = bondedEth;
//   }

//   const [createdAtBn] = await keepContract.functions.getOpenedTimestamp();
//   const createdAtTimestamp = createdAtBn.toNumber() * 1000;
//   deposit.createdAt = new Date(createdAtTimestamp);

//   const [lotSizeSatoshisBn] = await depositContract.functions.lotSizeSatoshis();
//   deposit.lotSizeSatoshis = lotSizeSatoshisBn;

//   const [undercollateralizedThresholdPercent] = await depositContract.functions.undercollateralizedThresholdPercent();
//   deposit.undercollateralizedThresholdPercent = undercollateralizedThresholdPercent;

//   deposit.operators = operators.map((o) => {
//     const operator = new Operator();
//     operator.address = o.toLowerCase();
//     return operator;
//   });

//   return deposit;
// }

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

// async function syncDeposits() {
//   const lastSyncedId = await getLastSyncedId();
//   const depositCount = await getDepositCount();
//   const diff = depositCount - lastSyncedId;

//   await syncDeposit(5);
//   // for (let id = lastSyncedId + 1; id < depositCount; id++) {
//   //   await syncDeposit(id);
//   // }
// }

// async function getLastSyncedId(): Promise<number> {
//   const connection = getConnection();
//   const [{ max }] = await connection
//     .createQueryBuilder()
//     .select('MAX("onChainId") as max')
//     .from(Deposit, 'd')
//     .execute();
//   logger.debug(`last synced deposit id: ${max}`);

//   return max || 0;
// }

// async function getDepositCount(): Promise<number> {
//   const [resBn] = await bondedEcdsaKeepFactoryContract.functions.getKeepCount();
//   const num = resBn.toNumber();
//   logger.debug(`deposit count: ${num}`);

//   return num;
// }

// async function syncDeposit(id: number): Promise<void> {
//   const [bondedEcdsaKeepAddress] = await bondedEcdsaKeepFactoryContract.functions.getKeepAtIndex(id);
//   const bondedEcdsaKeepContract = bondedEcdsaKeepContractAt(bondedEcdsaKeepAddress);
//   const [members] = await bondedEcdsaKeepContract.functions.getMembers();
//   console.log(members);
//   const [bondAmountBn] = await bondedEcdsaKeepContract.functions.checkBondAmount();
//   console.log(bondAmountBn.toString());
//   const [depositAddress] = await bondedEcdsaKeepContract.functions.getOwner();
//   console.log(depositAddress);
//   const [createdAtBn] = await bondedEcdsaKeepContract.functions.getOpenedTimestamp();
//   const createdAtTimestamp = createdAtBn.toNumber() * 1000;
//   console.log(createdAtTimestamp);
//   const depositContract = depositContractAt(depositAddress);
//   const [statusCodeBn] = await depositContract.functions.currentState();
//   const statusCode = statusCodeBn.toNumber();
//   const status = DepositStatus[statusCode];
//   console.log(statusCode, status);
//   const [lotSizeSatoshisBn] = await depositContract.functions.lotSizeSatoshis();
//   console.log(lotSizeSatoshisBn.toString());
//   const [undercollateralizedThresholdPercent] = await depositContract.functions.undercollateralizedThresholdPercent();
//   console.log(undercollateralizedThresholdPercent);

//   // await storeDepositAndOperators();
// }

// async function storeDepositAndOperators();

export default {
  init,
};
