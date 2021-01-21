import { getConnection } from 'typeorm';

import { Deposit } from '../../entities/Deposit';
import { createLogger } from '../../logger';

const logger = createLogger('depositHelper');

export async function getDeposit(address: string): Promise<Deposit> {
  const deposit = await getConnection()
    .createEntityManager()
    .findOne(Deposit, {
      where: { depositAddress: address },
    });

  logger.debug(`Retrieved deposit for address ${address} \n ${JSON.stringify(deposit, null, 2)}`);

  return deposit;
}
