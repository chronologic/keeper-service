import { getConnection } from 'typeorm';

import { depositContractAt } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { DepositStatus } from '../../types';
import { createLogger } from '../../logger';
import { ensureApproveSpendingTbtc } from './redeemApprove';
import { ensureRedemptionRequested } from './requestRedemption';
import { ensureRedemptionSigProvided } from './redemptionSig';
import { ensureBtcReceived } from './btcReception';
import { getDeposit } from '../depositHelper';
import { ensureRedemptionProofProvided } from './redemptionProof';
import { ensureDepositCreated } from './createDeposit';

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
  if (!busy) {
    busy = true;
    const deposit = await getDepositToProcess();

    if (deposit) {
      await processDeposit(deposit);
      busy = false;
      checkForDepositToProcess();
    }
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
  // TODO: check for errors, if 3 errors in one operation type - set deposit state to ERROR
  const depositContract = depositContractAt(deposit.depositAddress);

  let updatedDeposit = await ensureApproveSpendingTbtc(deposit, depositContract);

  updatedDeposit = await ensureRedemptionRequested(updatedDeposit, depositContract);

  updatedDeposit = await ensureRedemptionSigProvided(updatedDeposit, depositContract);

  updatedDeposit = await ensureBtcReceived(updatedDeposit);

  updatedDeposit = await ensureRedemptionProofProvided(updatedDeposit, depositContract);

  // MINTING ///////////////////////

  updatedDeposit = await ensureDepositCreated(updatedDeposit, depositContract);
}

export default { init };
