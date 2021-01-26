import { BigNumber } from 'ethers';
import { getConnection } from 'typeorm';
import { Payment, User, UserDepositTxPayment } from '../entities';

async function updateAllUserBalances(): Promise<void> {
  const users = await getConnection().createEntityManager().find(User);

  for (const user of users) {
    await updateUserBalance(user.id);
  }
}

async function updateUserBalancesForDeposit(depositId: number): Promise<void> {
  const ids = await getConnection()
    .createQueryBuilder()
    .select('DISTINCT u.id')
    .from(User, 'u')
    .innerJoin('u.operators', 'o')
    .innerJoin('o.deposits', 'd')
    .where('d.id = :depositId', { depositId })
    .execute();

  for (const id of ids) {
    await updateUserBalance(id);
  }
}

async function updateUserBalance(userId: number): Promise<BigNumber> {
  const amountIn = await getUserPaymentsSum(userId);
  const amountOut = await getUserDepositTxPaymentsSum(userId);
  const balanceEth = amountIn.sub(amountOut);

  await getConnection().createEntityManager().update(User, { id: userId }, { balanceEth });

  return balanceEth;
}

async function getUserDepositTxPaymentsSum(userId: number): Promise<BigNumber> {
  const [{ sum }] = await getConnection()
    .createQueryBuilder()
    .select('SUM("txCostEthEquivalentWithFee") as sum')
    .from(UserDepositTxPayment, 'up')
    .where('up."userId" = :userId', { userId })
    .execute();

  return BigNumber.from(sum);
}

async function getUserPaymentsSum(userId: number): Promise<BigNumber> {
  const [{ sum }] = await getConnection()
    .createQueryBuilder()
    .select('SUM("amount") as sum')
    .from(Payment, 'p')
    .where('p."userId" = :userId', { userId })
    .andWhere('p.status = :status', { status: Payment.Status.CONFIRMED })
    .execute();

  return BigNumber.from(sum);
}

export default {
  updateAllUserBalances,
  updateUserBalancesForDeposit,
};
