import { BigNumber } from 'ethers';
import { getConnection, User, UserDepositTxPayment, Payment } from 'keeper-db';

import { WARNING_USER_BALANCE_ETH } from '../env';
import { createLogger } from '../logger';
import { bnToNumberEth, numberToBnEth } from '../utils';
import emailService from './emailService';
import userHelper from './userHelper';

const logger = createLogger('userAccountingHelper');

async function updateAllUserBalances(): Promise<void> {
  logger.info('Updating all user balances...');
  const users = await getConnection().createEntityManager().find(User);

  for (const user of users) {
    await updateUserBalance(user.id);
  }
  logger.info('Updated all user balances.');
}

async function updateUserBalancesForDeposit(depositId: number): Promise<void> {
  const users = await userHelper.getUsersForDeposit(depositId);

  for (const user of users) {
    await updateUserBalance(user.id);
  }
}

async function updateUserBalance(userId: number): Promise<BigNumber> {
  try {
    logger.info(`Updating user ${userId}'s balance...`);

    const amountIn = await getUserPaymentsSum(userId);
    const amountOut = await getUserDepositTxPaymentsSum(userId);
    const balanceEth = amountIn.sub(amountOut);

    await getConnection().createEntityManager().update(User, { id: userId }, { balanceEth });

    logger.info(`Updated user ${userId}'s balance.`);

    return balanceEth;
  } catch (e) {
    logger.error(e);
  }

  return BigNumber.from('0');
}

async function getUserDepositTxPaymentsSum(userId: number): Promise<BigNumber> {
  const [{ sum }] = await getConnection()
    .createQueryBuilder()
    .select('SUM("txCostEthEquivalentWithFee") as sum')
    .from(UserDepositTxPayment, 'up')
    .where('up."userId" = :userId', { userId })
    .execute();

  return BigNumber.from(sum || '0');
}

async function getUserPaymentsSum(userId: number): Promise<BigNumber> {
  const [{ sum }] = await getConnection()
    .createQueryBuilder()
    .select('SUM("amount") as sum')
    .from(Payment, 'p')
    .where('p."userId" = :userId', { userId })
    .andWhere('p.status = :status', { status: Payment.Status.CONFIRMED })
    .execute();

  return BigNumber.from(sum || '0');
}

async function checkAllUserBalances(): Promise<void> {
  logger.info('Checking all user balances...');
  const users = await getConnection().createEntityManager().find(User);

  for (const user of users) {
    await checkUserBalance(user);
  }
  logger.info('Checked all user balances.');
}

async function checkUserBalancesForDeposit(depositId: number): Promise<void> {
  logger.info(`Checking all user balances for deposit ${depositId}...`);
  const users = await userHelper.getUsersForDeposit(depositId);

  for (const user of users) {
    await checkUserBalance(user);
  }
  logger.info(`Checked all user balances for deposit ${depositId}.`);
}

async function checkUserBalance(user: User): Promise<void> {
  try {
    logger.info(`Checking user ${user.id}'s balance...`);
    if (user.balanceEth.lte(numberToBnEth(WARNING_USER_BALANCE_ETH))) {
      logger.info(
        `User ${user.id}'s balance is too low. Min: ${WARNING_USER_BALANCE_ETH}, current: ${bnToNumberEth(
          user.balanceEth
        )}`
      );
      emailService.accountBalanceLow(user);
    }
    logger.info(`Checked user ${user.id}'s balance.`);
  } catch (e) {
    logger.error(e);
  }
}

export default {
  updateAllUserBalances,
  updateUserBalancesForDeposit,
  checkAllUserBalances,
  checkUserBalancesForDeposit,
};
