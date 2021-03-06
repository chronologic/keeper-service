import { getConnection, Deposit, Operator } from 'keeper-db';

import { createLogger } from '../logger';
import { depositContractAt, keepContractAt } from '../contracts';

const logger = createLogger('depositHelper');

async function getById(depositId: number): Promise<Deposit> {
  const deposit = await getConnection()
    .createEntityManager()
    .findOne(Deposit, {
      where: { id: depositId },
      relations: ['mintedDeposit'],
    });

  logger.debug(`Retrieved deposit for id ${depositId}`, deposit);

  return deposit;
}

async function getByAddress(address: string): Promise<Deposit> {
  const deposit = await getConnection()
    .createEntityManager()
    .findOne(Deposit, {
      where: { depositAddress: address },
      relations: ['mintedDeposit'],
    });

  logger.debug(`Retrieved deposit for address ${address}`, deposit);

  return deposit;
}

async function updateStatus(address: string, status: Deposit['Status']): Promise<boolean> {
  logger.debug(`Updating status of deposit ${address} to ${status}...`);
  const existingDeposit = await getByAddress(address);
  if (existingDeposit.status === status) {
    logger.debug(`Status of deposit ${address} already is ${status}`);
    return false;
  }

  const statusCode = Deposit.Status[status] as any;
  await getConnection().createEntityManager().update(Deposit, { depositAddress: address }, { status, statusCode });

  logger.debug(`Updated status of deposit ${address} to ${status}.`);

  return true;
}

async function updateSystemStatus(address: string, systemStatus: Deposit['SystemStatus']): Promise<boolean> {
  logger.debug(`Updating system status of deposit ${address} to ${systemStatus}...`);
  const existingDeposit = await getByAddress(address);
  if (existingDeposit.systemStatus === systemStatus) {
    logger.debug(`System status of deposit ${address} already is ${systemStatus}`);
    return false;
  }

  await getConnection().createEntityManager().update(Deposit, { depositAddress: address }, { systemStatus });

  logger.debug(`Updated system status of deposit ${address} to ${systemStatus}`);

  return true;
}

async function build(address: string, createdAtBlock: number): Promise<Deposit> {
  logger.debug(`Building deposit ${address} created at block ${createdAtBlock}...`);
  const deposit = new Deposit();
  deposit.blockNumber = createdAtBlock;

  const depositContract = depositContractAt(address);

  deposit.depositAddress = address;

  deposit.statusCode = await depositContract.getStatusCode();
  deposit.status = Deposit.Status[deposit.statusCode] as any;

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

  logger.debug(`Built deposit ${address} created at block ${createdAtBlock}`, deposit);

  return deposit;
}

async function buildAndStore(address: string, createdAtBlock: number): Promise<Deposit> {
  const deposit = await build(address, createdAtBlock);

  return store(deposit);
}

async function store(deposit: Deposit): Promise<Deposit> {
  logger.debug(`Storing deposit ${deposit.depositAddress}...`, deposit);
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
    blockNumber: Math.min(depositDb?.blockNumber || Infinity, deposit.blockNumber),
  })) as Deposit;

  logger.debug(`Stored deposit ${deposit.depositAddress}`, deposit);

  return depositDb;
}

async function storeOperator(operator: Operator): Promise<Operator> {
  logger.debug(`Storing operator ${operator.address}...`, operator);
  const connection = getConnection();
  const manager = connection.createEntityManager();

  let operatorDb = await manager.findOne(Operator, {
    where: { address: operator.address },
  });

  if (operatorDb) {
    logger.debug(`Operator ${operator.address} already exists`);
    return operatorDb;
  }

  operatorDb = (await manager.save(Operator, operator)) as Operator;

  logger.debug(`Stored operator ${operator.address}`, operator);

  return operatorDb;
}

export default {
  getById,
  getByAddress,
  updateStatus,
  updateSystemStatus,
  buildAndStore,
  build,
  store,
};
