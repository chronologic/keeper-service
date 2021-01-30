import { getConnection } from 'typeorm';
import { MIN_USER_BALANCE_ETH } from '../env';
import { User } from '../entities';
import { numberToBnEth } from '../utils';

async function getProtectedUsersForDeposit(depositId: number): Promise<User[]> {
  const q = getConnection()
    .createQueryBuilder()
    .select('*')
    .from(User, 'u')
    .where('"u.balanceEth" > :minBalance', { minBalance: numberToBnEth(MIN_USER_BALANCE_ETH) });

  const subq = q
    .subQuery()
    .select('1')
    .from(User, 'u2')
    .innerJoin('u2.operators', 'o')
    .innerJoin('o.deposits', 'd')
    .where('d.id = :depositId', { depositId })
    .andWhere('u2.id = u.id');

  const protectedUsers = await q.andWhere(`exists ${subq.getQuery()}`).execute();

  return protectedUsers;
}

export default {
  getProtectedUsersForDeposit,
};
