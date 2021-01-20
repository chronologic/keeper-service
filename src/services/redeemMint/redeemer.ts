import { getConnection } from 'typeorm';

import { depositContractAt } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { DepositStatus } from '../../types';
import { createLogger } from '../../logger';
import { ensureApproveSpendingTbtc } from './redeemApprove';
import { ensureRedemptionRequested } from './requestRedemption';
import { ensureRedemptionSigProvided } from './redemptionSig';

const logger = createLogger('redemption');
let busy = false;

export async function init(): Promise<any> {
  console.log('init');
  const deposit = await getDeposit('0xd7708a3c85191fc64ebd5f1015eb02dfb0f7eca4');
  const depositContract = depositContractAt(deposit.depositAddress);
  const statusCode = await depositContract.getStatusCode();
  console.log('deposit is in status:', DepositStatus[statusCode]);
  processDeposit(deposit);
  // checkForDepositToProcess();
}

export async function checkForDepositToProcess(): Promise<void> {
  busy = true;
  const deposit = await getDepositToProcess();

  if (deposit) {
    await processDeposit(deposit);
    checkForDepositToProcess();
  } else {
    busy = false;
  }
}

async function getDepositToProcess(): Promise<Deposit> {
  const connection = getConnection();
  const deposits = await connection.createEntityManager().find(Deposit, {
    where: { statusCode: [DepositStatus.KEEPER_QUEUED_FOR_REDEMPTION, DepositStatus.KEEPER_REDEEMING] },
    order: { statusCode: 'DESC', createDate: 'ASC' },
  });

  // TODO: order by collateralization %

  logger.info(`Found ${deposits.length} deposits to process`);

  return deposits[0];
}

async function processDeposit(deposit: Deposit): Promise<void> {
  // TODO: change deposit state to REDEEMING
  const depositContract = depositContractAt(deposit.depositAddress);

  await ensureApproveSpendingTbtc(deposit, depositContract);

  await ensureRedemptionRequested(deposit, depositContract);

  await ensureRedemptionSigProvided(deposit, depositContract);

  // await ensureProvideRedemptionSignature(deposit, depositContract);
  // try resume approve spending
  // try resume
}

async function getDeposit(address: string): Promise<Deposit> {
  const conn = await getConnection();
  const manager = conn.createEntityManager();

  const deposit = await manager.findOne(Deposit, {
    where: { depositAddress: address },
  });

  logger.debug(`Retrieved deposit for address ${address} \n ${JSON.stringify(deposit, null, 2)}`);

  return deposit;
}

export default { init };
