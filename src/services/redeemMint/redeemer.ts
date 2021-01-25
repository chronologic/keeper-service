/* eslint-disable camelcase */
import { getConnection } from 'typeorm';

import { createLogger } from '../../logger';
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
import { Deposit, DepositTx } from '../../entities';
import depositTxHelper, { IDepositTxParams } from './depositTxHelper';
import depositHelper from '../depositHelper';

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
      checkForDepositToProcess();
    }
    busy = false;
  }
}

async function getDepositToProcess(): Promise<Deposit> {
  const connection = getConnection();
  const deposits = await connection.createEntityManager().find(Deposit, {
    where: { statusCode: [Deposit.SystemStatus.QUEUED_FOR_REDEMPTION, Deposit.SystemStatus.REDEEMING] },
    order: { statusCode: 'DESC', createDate: 'ASC' },
  });

  // TODO: order by collateralization %
  // TODO: double check collateralization %

  logger.info(`Found ${deposits.length} deposits to process`);

  return deposits[0];
}

async function processDeposit(deposit: Deposit): Promise<void> {
  // TODO: change deposit state to REDEEMING
  // TODO: check for errors, if 3 errors in one operation type - set deposit state to ERROR
  // TODO: between each call:
  // - update deposit
  // - check deposit status
  // - check balances

  // TODO: email if process changed from queued to redeeming

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
    await handler({
      deposit: updatedDeposit,
      operationType: step.operationType,
      confirmFn: step.confirm,
      executeFn: step.execute,
    });
  }

  // TODO: email on success/error

  // refresh system balances
}

async function handler({
  deposit,
  confirmFn,
  executeFn,
  operationType,
}: // retries,
{
  deposit: Deposit;
  confirmFn: ConfirmFn;
  executeFn: ExecuteFn;
  operationType: DepositTx['Type'];
}): Promise<void> {
  logger.info(`Initiating ${operationType} for deposit ${deposit.depositAddress}...`);
  // TODO: double check status on blockchain
  // TODO: check balances
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

    await depositTxHelper.storeAndUpdateUserBalance(deposit, res);

    return res;
  } catch (e) {
    logger.error(e?.message);
    await depositTxHelper.storeAndUpdateUserBalance(deposit, {
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

    await depositTxHelper.storeAndUpdateUserBalance(deposit, res);

    return res;
  } catch (e) {
    logger.error(e?.message);
    await depositTxHelper.storeAndUpdateUserBalance(deposit, {
      status: DepositTx.Status.ERROR,
      operationType,
    });
    throw e;
  }
}

export default { init };
