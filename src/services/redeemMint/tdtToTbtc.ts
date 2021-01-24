import { depositContractAt, depositToken, vendingMachine } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import {
  BlockchainType,
  DepositOperationLogDirection,
  DepositOperationLogStatus,
  DepositOperationLogType,
  IEthTx,
} from '../../types';
import { createLogger } from '../../logger';
import { DepositOperationLog } from '../../entities/DepositOperationLog';
import { ethClient } from '../../clients';
import priceFeed from '../priceFeed';
import {
  getOperationLogInStatus,
  getOperationLogsOfType,
  hasOperationLogInStatus,
  storeOperationLog,
} from './operationLogHelper';
import { getDeposit } from '../depositHelper';
import { weiToSatoshi } from '../../utils';

const logger = createLogger('redeemApprove');

export async function ensureTdtToTbtc(deposit: Deposit): Promise<Deposit> {
  logger.info(`Ensuring tdt approve for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain -
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.MINT_TDT_TO_TBTC);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`Tdt approve is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `Tdt approve is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmTdtToTbtc(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    const tx = await tdtToTbtc(deposit);
    await confirmTdtToTbtc(deposit, tx.hash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmTdtToTbtc(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for TDT approve and call for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);
  logger.info(`Got confirmations for TDT approve and call for deposit ${deposit.depositAddress}.`);
  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  const signerFeeTbtc = await depositContract.getSignerFeeTbtc();
  const signerFeeSats = weiToSatoshi(signerFeeTbtc);
  const signerFeeEth = await priceFeed.convertSatoshiToWei(signerFeeSats);
  const txCost = signerFeeEth.add(receipt.gasUsed);

  // TODO: get the transferred amount and calculate correct cost

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.operationType = DepositOperationLogType.MINT_TDT_TO_TBTC;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = success ? DepositOperationLogStatus.CONFIRMED : DepositOperationLogStatus.ERROR;
  log.blockchainType = BlockchainType.ETH;
  log.txCostEthEquivalent = txCost;
  log.txCostUsdEquivalent = await priceFeed.convertWeiToUsd(txCost);

  await storeOperationLog(deposit, log);
}

async function tdtToTbtc(deposit: Deposit): Promise<IEthTx> {
  const tx = await vendingMachine.tdtToTbtc(deposit.mintedDeposit.depositAddress);

  const log = new DepositOperationLog();
  log.blockchainType = BlockchainType.ETH;
  log.txHash = tx.hash;
  log.operationType = DepositOperationLogType.MINT_TDT_TO_TBTC;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;

  await storeOperationLog(deposit, log);

  return tx;
}
