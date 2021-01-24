import { getConnection } from 'typeorm';

import { Deposit } from '../entities/Deposit';
import { Operator } from '../entities/Operator';
import { createLogger } from '../logger';
import { DepositStatus } from '../types';
import { depositContractAt, keepContractAt } from '../contracts';

const logger = createLogger('depositHelper');

export async function getDeposit(address: string): Promise<Deposit> {
  const deposit = await getConnection()
    .createEntityManager()
    .findOne(Deposit, {
      where: { depositAddress: address },
      relations: ['mintedDeposit'],
    });

  logger.debug(`Retrieved deposit for address ${address} \n ${JSON.stringify(deposit, null, 2)}`);

  return deposit;
}

export async function buildDeposit(address: string, createdAtBlock: number): Promise<Deposit> {
  const deposit = new Deposit();
  deposit.blockNumber = createdAtBlock;

  const depositContract = depositContractAt(address);

  deposit.depositAddress = address;

  deposit.statusCode = await depositContract.getStatusCode();
  deposit.status = DepositStatus[deposit.statusCode];

  deposit.keepAddress = await depositContract.getKeepAddress();
  const keepContract = keepContractAt(deposit.keepAddress);

  deposit.bondedEth = await keepContract.getBondedEth();

  const createdAtTimestamp = await keepContract.getOpenedTimestamp();
  deposit.createdAt = new Date(createdAtTimestamp);

  deposit.lotSizeSatoshis = await depositContract.getLotSizeSatoshis();

  deposit.undercollateralizedThresholdPercent = await depositContract.getUndercollateralizedThresholdPercent();

  const operators = await keepContract.getMembers();

  deposit.operators = operators.map((o: string) => {
    const operator = new Operator();
    operator.address = o;
    return operator;
  });

  return deposit;
}

export async function buildAndStoreDepoist(address: string, createdAtBlock: number): Promise<Deposit> {
  const deposit = await buildDeposit(address, createdAtBlock);

  return storeDeposit(deposit);
}

export async function storeDeposit(deposit: Deposit): Promise<Deposit> {
  const connection = getConnection();
  const manager = connection.createEntityManager();
  if (deposit.operators) {
    // eslint-disable-next-line no-param-reassign
    deposit.operators = await Promise.all(deposit.operators.map(storeOperator));
  }

  let depositDb = await manager.findOne(Deposit, {
    where: { depositAddress: deposit.depositAddress },
  });

  depositDb = (await manager.save(Deposit, {
    ...depositDb,
    ...deposit,
    blockNumber: Math.min(depositDb.blockNumber, deposit.blockNumber),
  })) as Deposit;

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
