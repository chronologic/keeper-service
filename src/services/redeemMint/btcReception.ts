import { tbtcConstants } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import {
  BlockchainType,
  DepositOperationLogDirection,
  DepositOperationLogStatus,
  DepositOperationLogType,
} from '../../types';
import { createLogger } from '../../logger';
import { DepositOperationLog } from '../../entities/DepositOperationLog';
import { btcClient } from '../../clients';
import {
  getOperationLogInStatus,
  getOperationLogsOfType,
  hasOperationLogInStatus,
  storeOperationLog,
} from './operationLogHelper';
import { getDeposit } from './depositHelper';

const logger = createLogger('btcReception');

export async function ensureBtcReceived(deposit: Deposit): Promise<Deposit> {
  logger.info(`Ensuring BTC received for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain -
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_BTC_RECEPTION);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`BTC reception is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `BTC reception is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmBtcReceived(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    logger.info(`Waiting for BTC reception for deposit ${deposit.depositAddress}...`);
    const tx = await waitForIncomingBtc(deposit);
    await confirmBtcReceived(deposit, tx.txid);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmBtcReceived(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for BTC reception for deposit ${deposit.depositAddress}...`);
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();
  const txReceipt = await btcClient.waitForConfirmations(txHash, minConfirmations);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption sig for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.fromAddress = txReceipt.vin[0].txid;
  log.toAddress = deposit.redemptionAddress;
  log.operationType = DepositOperationLogType.REDEEM_BTC_RECEPTION;
  log.direction = DepositOperationLogDirection.IN;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.BITCOIN;

  await storeOperationLog(deposit, log);
}

async function waitForIncomingBtc(deposit: Deposit): Promise<btcClient.IRawTx> {
  logger.info(`Waiting for incoming BTC for deposit ${deposit.depositAddress}...`);
  const minReceivedValue = deposit.lotSizeSatoshis.mul(90).div(100);

  const tx = await btcClient.waitForTransactionToAddress(deposit.redemptionAddress, minReceivedValue);

  const log = new DepositOperationLog();
  log.txHash = tx.txid;
  log.fromAddress = tx.vin[0].txid;
  log.toAddress = deposit.redemptionAddress;
  log.operationType = DepositOperationLogType.REDEEM_BTC_RECEPTION;
  log.direction = DepositOperationLogDirection.IN;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.BITCOIN;

  await storeOperationLog(deposit, log);

  return tx;
}
