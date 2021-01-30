/* eslint-disable camelcase */
import { getConnection } from 'typeorm';

import { createLogger } from '../../logger';
import { Deposit, DepositTx } from '../../entities';
import depositTxHelper, { IDepositTxParams } from '../depositTxHelper';
import depositHelper from '../depositHelper';
import userAccountingHelper from '../userAccountingHelper';
import emailService from '../emailService';
import systemAccountingHelper from '../systemAccountingHelper';
import redeem_1_approveTbtc from './redeem_1_approveTbtc';
import redeem_2_requestRedemption from './redeem_2_requestRedemption';
import redeem_3_redemptionSig from './redeem_3_redemptionSig';
import redeem_4_btcRelease from './redeem_4_btcRelease';
import redeem_5_redemptionProof from './redeem_5_redemptionProof';
import mint_1_createDeposit from './mint_1_createDeposit';
import mint_2_retrievePubkey from './mint_2_retrievePubkey';
import mint_3_fundBtc from './mint_3_fundBtc';
import mint_4_fundingProof from './mint_4_fundingProof';
import mint_5_approveTdt from './mint_5_approveTdt';
import mint_6_tdtToTbtc from './mint_6_tdtToTbtc';

type ConfirmFn = (deposit: Deposit, txHash: string) => Promise<IDepositTxParams>;
type ExecuteFn = (deposit: Deposit) => Promise<IDepositTxParams>;

interface IStepParams {
  operationType: DepositTx['Type'];
  confirm: ConfirmFn;
  execute: ExecuteFn;
}

const logger = createLogger('redeem/mint');
let busy = false;

export async function init(): Promise<any> {
  await checkForDepositToProcess();
  // console.log('init');
  // const deposit = await getDeposit('0x451bd3a7d204ce27e3c3524a7fd5f3f602ef1b4a');
  // const depositContract = depositContractAt(deposit.depositAddress);
  // const statusCode = await depositContract.getStatusCode();
  // console.log('deposit is in status:', Deposit.Status[statusCode]);
  // processDeposit(deposit);
  // checkForDepositToProcess();
  // const deposit = depositContractAt('0x41f92f9c627132a613a14de9a28aebc721607b90');
  // const statusCode = await deposit.getStatusCode();
  // console.log('deposit is in status:', DepositStatus[statusCode]);
  // const signerFee = await deposit.getSignerFeeTbtc();
  // console.log('signer fee:', signerFee.toString());
}

export async function checkForDepositToProcess(): Promise<void> {
  if (!busy) {
    busy = true;
    const deposit = await getDepositToProcess();

    if (deposit) {
      await processDeposit(deposit);
      busy = false;
      // when a deposit is processed, check for more (new redemption could've been triggered in the meantime)
      checkForDepositToProcess();
    }
    busy = false;
  }
}

async function getDepositToProcess(): Promise<Deposit> {
  const connection = getConnection();
  const deposits = await connection.createEntityManager().find(Deposit, {
    where: { systemStatus: [Deposit.SystemStatus.QUEUED_FOR_REDEMPTION, Deposit.SystemStatus.REDEEMING] },
    // ordering by status DESC ensures deposits in REDEEMING status will be processed first (i.e. interrupted process will be picked up)
    order: { systemStatus: 'DESC', createDate: 'ASC' },
  });

  // TODO: order by collateralization % ?
  // TODO: double check collateralization %

  logger.info(`Found ${deposits.length} deposits to process`);

  return deposits[0];
}

async function processDeposit(deposit: Deposit): Promise<void> {
  await systemAccountingHelper.rememberSystemBalances();

  try {
    const updated = await depositHelper.updateSystemStatus(deposit.depositAddress, Deposit.SystemStatus.REDEEMING);

    if (updated) {
      emailService.redemptionStart(deposit);
      emailService.admin.redemptionStart(deposit);
    }

    const steps: IStepParams[] = [
      redeem_1_approveTbtc,
      redeem_2_requestRedemption,
      redeem_3_redemptionSig,
      redeem_4_btcRelease,
      redeem_5_redemptionProof,
      mint_1_createDeposit,
      mint_2_retrievePubkey,
      mint_3_fundBtc,
      mint_4_fundingProof,
      mint_5_approveTdt,
      mint_6_tdtToTbtc,
    ];

    for (const step of steps) {
      const updatedDeposit = await depositHelper.getByAddress(deposit.depositAddress);
      await executeStep({
        deposit: updatedDeposit,
        operationType: step.operationType,
        confirmFn: step.confirm,
        executeFn: step.execute,
      });
    }

    emailService.redemptionComplete(deposit);
    emailService.admin.redemptionComplete(deposit);

    // TODO: check system balances before / after execution
  } catch (e) {
    logger.error(e?.message);
    emailService.redemptionError(deposit);
    emailService.admin.redemptionError(deposit, e);
  } finally {
    await userAccountingHelper.updateUserBalancesForDeposit(deposit.id);
    await userAccountingHelper.checkUserBalancesForDeposit(deposit.id);
    await systemAccountingHelper.compareSystemBalances();
    await systemAccountingHelper.checkSystemBalances();
  }
}

async function executeStep({
  deposit,
  confirmFn,
  executeFn,
  operationType,
}: {
  deposit: Deposit;
  confirmFn: ConfirmFn;
  executeFn: ExecuteFn;
  operationType: DepositTx['Type'];
}): Promise<void> {
  logger.info(`Initiating ${operationType} for deposit ${deposit.depositAddress}...`);

  if (depositTxHelper.hasConfirmedTxOfType(deposit.id, operationType)) {
    logger.info(`${operationType} is ${DepositTx.Status.CONFIRMED} for deposit ${deposit.depositAddress}.`);
  }

  const broadcastedTx = await depositTxHelper.getBroadcastedTxOfType(deposit.id, operationType);
  if (broadcastedTx) {
    logger.info(
      `${operationType} is in ${DepositTx.Status.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
    );
    await tryConfirmFn(confirmFn, deposit, broadcastedTx.txHash, operationType);
  }

  const res = await tryExecuteFn(executeFn, deposit, operationType);
  await tryConfirmFn(confirmFn, deposit, res.txHash, operationType);
}

async function tryConfirmFn(
  confirmFn: ConfirmFn,
  deposit: Deposit,
  txHash: string,
  operationType: DepositTx['Type']
): Promise<IDepositTxParams> {
  try {
    const res = await confirmFn(deposit, txHash);

    await depositTxHelper.storeAndAddUserPayments(deposit, res);

    return res;
  } catch (e) {
    logger.error(e?.message);
    await depositTxHelper.storeAndAddUserPayments(deposit, {
      status: DepositTx.Status.ERROR,
      txHash,
      operationType,
    });
    throw e;
  }
}

async function tryExecuteFn(
  executeFn: ExecuteFn,
  deposit: Deposit,
  operationType: DepositTx['Type']
): Promise<IDepositTxParams> {
  try {
    const res = await executeFn(deposit);

    await depositTxHelper.storeAndAddUserPayments(deposit, res);

    return res;
  } catch (e) {
    logger.error(e?.message);
    await depositTxHelper.storeAndAddUserPayments(deposit, {
      status: DepositTx.Status.ERROR,
      operationType,
    });
    throw e;
  }
}

export default { init };
