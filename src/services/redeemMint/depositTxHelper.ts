import { BigNumber } from 'ethers';
import { getConnection } from 'typeorm';

import { Deposit, DepositTx } from '../../entities';
import { createLogger } from '../../logger';
import priceFeed from '../priceFeed';

const logger = createLogger('depositTxHelper');

export interface IDepositTxParams {
  txHash?: string;
  operationType: DepositTx['Type'];
  status: DepositTx['Status'];
  txCostEthEquivalent?: BigNumber;
}

async function hasBroadcastedTxOfType(depositId: number, operationType: DepositTx['Type']): Promise<boolean> {
  const tx = await getBroadcastedTxOfType(depositId, operationType);
  return !!tx;
}

async function getBroadcastedTxOfType(depositId: number, operationType: DepositTx['Type']): Promise<DepositTx> {
  const txs = await getTxsOfTypeAndStatus(depositId, operationType, DepositTx.Status.BROADCASTED);
  return txs[0];
}

async function hasConfirmedTxOfType(depositId: number, operationType: DepositTx['Type']): Promise<boolean> {
  const tx = await getConfirmedTxOfType(depositId, operationType);
  return !!tx;
}

async function getConfirmedTxOfType(depositId: number, operationType: DepositTx['Type']): Promise<DepositTx> {
  const txs = await getTxsOfTypeAndStatus(depositId, operationType, DepositTx.Status.CONFIRMED);
  return txs[0];
}

async function getErrorCountOfType(depositId: number, operationType: DepositTx['Type']): Promise<number> {
  const txs = await getTxsOfTypeAndStatus(depositId, operationType, DepositTx.Status.ERROR);
  return txs.length;
}

async function getTxsOfTypeAndStatus(
  depositId: number,
  operationType: DepositTx['Type'],
  status: DepositTx['Status']
): Promise<DepositTx[]> {
  const logs = await getTxsForDeposit(depositId);
  return logs.filter((l) => l.operationType === operationType && l.status === status);
}

async function getTxsForDeposit(depositId: number): Promise<DepositTx[]> {
  const logs = await getConnection()
    .createQueryBuilder()
    .select('s')
    .from(DepositTx, 'dtx')
    .where({ depositId })
    // sorting ensures first found item is the latest
    .orderBy({ createdDate: 'DESC' })
    .execute();

  return logs;
}

async function storeAndUpdateUserBalance(
  deposit: Deposit,
  { txHash, operationType, status, txCostEthEquivalent = BigNumber.from('0') }: IDepositTxParams
): Promise<DepositTx> {
  logger.debug(`Storing log for deposit ${deposit.depositAddress}...`);
  const txCostUsdEquivalent = await priceFeed.convertWeiToUsd(txCostEthEquivalent);
  logger.debug(
    JSON.stringify({
      txHash,
      operationType,
      status,
      txCostEthEquivalent,
      txCostUsdEquivalent,
    })
  );
  const res = await store(deposit, {
    txHash,
    operationType,
    status,
    txCostEthEquivalent,
  });

  // TODO: implementme
  // if (!txCostEthEquivalent?.eq('0')) {
  //   await updateUserBalance(deposit, txCostEthEquivalent);
  // }

  return res;
}

async function store(
  deposit: Deposit,
  { txHash, operationType, status, txCostEthEquivalent = BigNumber.from('0') }: IDepositTxParams
): Promise<DepositTx> {
  logger.debug(`Storing log for deposit ${deposit.depositAddress}...`);
  const txCostUsdEquivalent = await priceFeed.convertWeiToUsd(txCostEthEquivalent);
  logger.debug(
    JSON.stringify({
      txHash,
      operationType,
      status,
      txCostEthEquivalent,
      txCostUsdEquivalent,
    })
  );
  const res = await getConnection()
    .createEntityManager()
    .save(DepositTx, {
      deposit,
      txHash,
      operationType,
      status,
      txCostEthEquivalent,
      txCostUsdEquivalent,
    } as DepositTx);

  return res;
}

export default {
  storeAndUpdateUserBalance,
  hasBroadcastedTxOfType,
  getBroadcastedTxOfType,
  hasConfirmedTxOfType,
  getConfirmedTxOfType,
  getErrorCountOfType,
};
