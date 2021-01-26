import { BigNumber } from 'ethers';
import { getConnection } from 'typeorm';

import { Deposit, DepositTx, User, UserDepositTxPayment } from '../entities';
import { MIN_USER_BALANCE_ETH, USER_TX_FEE_PERCENT } from '../env';
import { createLogger } from '../logger';
import { numberToBnEth } from '../utils';
import priceFeed from './priceFeed';

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
  const txs = await getTxsForDeposit(depositId);
  return txs.filter((l) => l.operationType === operationType && l.status === status);
}

async function getTxsForDeposit(depositId: number): Promise<DepositTx[]> {
  const txs = await getConnection()
    .createQueryBuilder()
    .select('*')
    .from(DepositTx, 'dtx')
    .where({ depositId })
    // sorting ensures first found item is the latest
    .orderBy({ createdDate: 'DESC' })
    .execute();

  return txs;
}

async function storeAndAddUserPayments(
  deposit: Deposit,
  { txHash, operationType, status, txCostEthEquivalent = BigNumber.from('0') }: IDepositTxParams
): Promise<DepositTx> {
  logger.debug(`Storing deposit tx for deposit ${deposit.depositAddress}...`);
  const res = await store(deposit, {
    txHash,
    operationType,
    status,
    txCostEthEquivalent,
  });

  if (!txCostEthEquivalent?.eq('0')) {
    await addUserTxPaymentRecords(res);
    await updateDepositRedemptionCost(res.depositId);
  }

  return res;
}

async function store(
  deposit: Deposit,
  { txHash, operationType, status, txCostEthEquivalent = BigNumber.from('0') }: IDepositTxParams
): Promise<DepositTx> {
  logger.debug(`Storing deposit tx for deposit ${deposit.depositAddress}...`);
  let txCostUsdEquivalent = 0;
  let txCostEthEquivalentWithFee = BigNumber.from('0');
  let txCostUsdEquivalentWithFee = 0;
  if (!txCostEthEquivalent.eq('0')) {
    txCostEthEquivalentWithFee = txCostEthEquivalent.mul((100 + USER_TX_FEE_PERCENT).toString()).div('100');
    txCostUsdEquivalent = await priceFeed.convertWeiToUsd(txCostEthEquivalent);
    txCostUsdEquivalentWithFee = (txCostUsdEquivalent * (100 + USER_TX_FEE_PERCENT)) / 100;
  }
  logger.debug({
    txHash,
    operationType,
    status,
    txCostEthEquivalent,
    txCostUsdEquivalent,
  });
  const res = await getConnection()
    .createEntityManager()
    .save(DepositTx, {
      deposit,
      txHash,
      operationType,
      status,
      txCostEthEquivalent,
      txCostUsdEquivalent,
      txCostEthEquivalentWithFee,
      txCostUsdEquivalentWithFee,
    } as DepositTx);

  return res;
}

async function addUserTxPaymentRecords(depositTx: DepositTx): Promise<void> {
  const conn = getConnection();
  const protectedUsers = await conn
    .createQueryBuilder()
    .select('DISTINCT "user.id"')
    .from(User, 'u')
    .innerJoin('u.operators', 'o')
    .innerJoin('o.deposits', 'd')
    .where('d.id = :depositId', { depositId: depositTx.depositId })
    .andWhere('"u.balanceEth" > :minBalance', { minBalance: numberToBnEth(MIN_USER_BALANCE_ETH) })
    .execute();

  const userCount = protectedUsers.length;

  await conn
    .createQueryBuilder()
    .insert()
    .into(UserDepositTxPayment)
    .values(
      protectedUsers.map(
        (id: number) =>
          ({
            userId: id,
            depositTx,
            txCostEthEquivalent: depositTx.txCostEthEquivalent.div(userCount),
            txCostEthEquivalentWithFee: depositTx.txCostEthEquivalentWithFee.div(userCount),
            txCostUsdEquivalent: depositTx.txCostUsdEquivalent / userCount,
            txCostUsdEquivalentWithFee: depositTx.txCostUsdEquivalentWithFee / userCount,
          } as UserDepositTxPayment)
      )
    )
    .execute();
}

async function updateDepositRedemptionCost(depositId: number): Promise<void> {
  const conn = getConnection();
  const costs = await conn
    .createQueryBuilder()
    .select(
      `SUM("txCostEthEquivalent") as "redemptionCostEthEquivalent",
       SUM("txCostEthEquivalentWithFee") as "redemptionCostEthEquivalentWithFree",
       SUM("txCostUsdEquivalent") as "redemptionCostUsdEquivalent",
       SUM("txCostUsdEquivalentWithFee") as "redemptionCostUsdEquivalentWithFee"`
    )
    .from(DepositTx, 'dtx')
    .where('"depositId" = :depositId', { depositId })
    .execute();

  await getConnection().createEntityManager().update(Deposit, { depositId }, costs);
}

export default {
  storeAndAddUserPayments,
  hasBroadcastedTxOfType,
  getBroadcastedTxOfType,
  hasConfirmedTxOfType,
  getConfirmedTxOfType,
  getErrorCountOfType,
};
