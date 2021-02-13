import { getConnection, User } from 'keeper-db';

import { MIN_USER_BALANCE_ETH } from '../env';
import { createLogger } from '../logger';
import { numberToBnEth } from '../utils';

const logger = createLogger('userHelper');

async function getUsersForDeposit(depositId: number): Promise<User[]> {
  const q = getConnection().getRepository(User).createQueryBuilder('u');

  const subq = q
    .subQuery()
    .select('1')
    .from(User, 'u2')
    .innerJoin('u2.operators', 'o')
    .innerJoin('o.deposits', 'd')
    .where('d.id = :depositId', { depositId })
    .andWhere('u2.id = u.id');

  logger.debug(`Fetching users for deposit ${depositId}...`);
  const users = await q.andWhere(`exists ${subq.getQuery()}`).getMany();
  logger.debug(`Fetched users for deposit ${depositId}`, users);

  return users;
}

async function getProtectedUsersForDeposit(depositId: number): Promise<User[]> {
  const q = getConnection()
    .getRepository(User)
    .createQueryBuilder('u')
    .where('u."balanceEth" >= :minBalance', { minBalance: numberToBnEth(MIN_USER_BALANCE_ETH).toString() });

  const subq = q
    .subQuery()
    .select('1')
    .from(User, 'u2')
    .innerJoin('u2.operators', 'o')
    .innerJoin('o.deposits', 'd')
    .where('d.id = :depositId', { depositId })
    .andWhere('u2.id = u.id');

  logger.debug(`Fetching protected users for deposit ${depositId}...`);
  const protectedUsers = await q.andWhere(`exists ${subq.getQuery()}`).getMany();
  logger.debug(`Fetched protected users for deposit ${depositId}`, protectedUsers);

  return protectedUsers;
}

export default {
  getUsersForDeposit,
  getProtectedUsersForDeposit,
};
