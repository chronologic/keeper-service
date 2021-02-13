import { BigNumber } from 'ethers';
import { getConnection, Deposit, DepositTx, UserDepositTxPayment } from 'keeper-db';

import { USER_TX_FEE_PERCENT } from '../env';
import { createLogger } from '../logger';
import priceFeed from './priceFeed';
import userHelper from './userHelper';

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
  return txs.filter((tx) => tx.operationType === operationType && tx.status === status);
}

async function getTxsForDeposit(depositId: number): Promise<DepositTx[]> {
  logger.debug(`Fetching txs for deposit ${depositId}...`);
  const txs = await getConnection()
    .getRepository(DepositTx)
    .createQueryBuilder('dtx')
    .where({ depositId })
    // sorting ensures first found item is the latest
    // eslint-disable-next-line no-useless-computed-key
    .orderBy({ ['"createDate"']: 'DESC' })
    .getMany();

  logger.debug(`Fetched txs for deposit ${depositId}.`, txs);

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
  const protectedUsers = await userHelper.getProtectedUsersForDeposit(depositTx.depositId);

  const userCount = protectedUsers.length;

  await conn
    .createQueryBuilder()
    .insert()
    .into(UserDepositTxPayment)
    .values(
      protectedUsers.map(
        (user) =>
          ({
            userId: user.id,
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
  logger.debug(`Fetching sum of tx costs for deposit ${depositId}...`);
  const [costs] = await conn
    .createQueryBuilder()
    .select(
      `SUM("txCostEthEquivalent") as "redemptionCostEthEquivalent",
       SUM("txCostEthEquivalentWithFee") as "redemptionCostEthEquivalentWithFee",
       SUM("txCostUsdEquivalent") as "redemptionCostUsdEquivalent",
       SUM("txCostUsdEquivalentWithFee") as "redemptionCostUsdEquivalentWithFee"`
    )
    .from(DepositTx, 'dtx')
    .where('dtx."depositId" = :depositId', { depositId })
    .execute();

  logger.debug(`Fetched sum of tx costs for deposit ${depositId}.`, costs);

  logger.debug(`Updating redemption costs for deposit ${depositId}...`);
  await conn.createEntityManager().update(Deposit, { id: depositId }, costs);
  logger.debug(`Updated redemption costs for deposit ${depositId}.`);
}

export default {
  storeAndAddUserPayments,
  hasBroadcastedTxOfType,
  getBroadcastedTxOfType,
  hasConfirmedTxOfType,
  getConfirmedTxOfType,
  getErrorCountOfType,
};
