import { getConnection } from 'typeorm';

import { Deposit } from '../entities/Deposit';
import logger from '../logger';
import { bondedEcdsaKeepContractAt, bondedEcdsaKeepFactoryContract, depositContractAt } from './ethProvider';

async function init(): Promise<void> {
  await syncDeposits();
}

async function syncDeposits() {
  const lastSyncedId = await getLastSyncedId();
  const depositCount = await getDepositCount();
  const diff = depositCount - lastSyncedId;

  await syncDeposit(5);
  // for (let id = lastSyncedId + 1; id < depositCount; id++) {
  //   await syncDeposit(id);
  // }
}

async function getLastSyncedId(): Promise<number> {
  const connection = getConnection();
  const [{ max }] = await connection
    .createQueryBuilder()
    .select('MAX("onChainId") as max')
    .from(Deposit, 'd')
    .execute();
  logger.debug(`last synced deposit id: ${max}`);

  return max || 0;
}

async function getDepositCount(): Promise<number> {
  const [resBn] = await bondedEcdsaKeepFactoryContract.functions.getKeepCount();
  const num = resBn.toNumber();
  logger.debug(`deposit count: ${num}`);

  return num;
}

async function syncDeposit(id: number): Promise<void> {
  const [bondedEcdsaKeepAddress] = await bondedEcdsaKeepFactoryContract.functions.getKeepAtIndex(id);
  const bondedEcdsaKeepContract = bondedEcdsaKeepContractAt(bondedEcdsaKeepAddress);
  const [members] = await bondedEcdsaKeepContract.functions.getMembers();
  console.log(members);
  const [depositAddress] = await bondedEcdsaKeepContract.functions.getOwner();
  console.log(depositAddress);
  const [createdAtBn] = await bondedEcdsaKeepContract.functions.getOpenedTimestamp();
  const createdAtTimestamp = createdAtBn.toNumber() * 1000;
  console.log(createdAtTimestamp);
  const depositContract = depositContractAt(depositAddress);
  const [statusCodeBn] = await depositContract.functions.currentState();
  const statusCode = statusCodeBn.toNumber();
  console.log(statusCode);
}

export default {
  init,
};
