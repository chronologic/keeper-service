import { keepContractAt, tbtcConstants, tbtcSystem } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import {
  BlockchainType,
  DepositOperationLogDirection,
  DepositOperationLogStatus,
  DepositOperationLogType,
} from '../../types';
import { createLogger } from '../../logger';
import { DepositOperationLog } from '../../entities/DepositOperationLog';
import { btcClient, ethClient } from '../../clients';
import {
  getOperationLogInStatus,
  getOperationLogsOfType,
  hasOperationLogInStatus,
  storeOperationLog,
} from './operationLogHelper';
import { getDeposit } from '../depositHelper';
import priceFeed from '../priceFeed';

const logger = createLogger('btcRelease');

export async function ensureBtcReleased(deposit: Deposit): Promise<Deposit> {
  logger.info(`Ensuring BTC released for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain -
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_BTC_RELEASE);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`BTC release is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `BTC release is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmBtcReleased(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    logger.info(`Waiting for BTC release for deposit ${deposit.depositAddress}...`);
    const tx = await releaseBtc(deposit);
    await confirmBtcReleased(deposit, tx.txid);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmBtcReleased(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for BTC reception for deposit ${deposit.depositAddress}...`);
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();
  const txReceipt = await btcClient.waitForConfirmations(txHash, minConfirmations);
  const txFee = await btcClient.getTransactionFee(txReceipt);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption sig for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.operationType = DepositOperationLogType.REDEEM_BTC_RELEASE;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.BTC;
  log.txCostEthEquivalent = await priceFeed.convertSatoshiToWei(txFee);
  log.txCostUsdEquivalent = await priceFeed.convertSatoshiToUsd(txFee);

  await storeOperationLog(deposit, log);
}

async function releaseBtc(deposit: Deposit): Promise<btcClient.IRawTx> {
  logger.info(`Releasing BTC for deposit ${deposit.depositAddress}...`);

  const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_REDEMPTION_REQUEST);

  const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);

  const redemptionDetails = await tbtcSystem.getRedemptionDetailsFromEvent(
    broadcastedLog.txHash,
    deposit.depositAddress,
    deposit.blockNumber
  );

  const outputValue = redemptionDetails.utxoValue.sub(redemptionDetails.requestedFee);
  const unsignedTransaction = btcClient.constructOneInputOneOutputWitnessTransaction(
    redemptionDetails.outpoint.replace('0x', ''),
    // We set sequence to `0` to be able to replace by fee. It reflects
    // bitcoin-spv:
    // https://github.com/summa-tx/bitcoin-spv/blob/2a9d594d9b14080bdbff2a899c16ffbf40d62eef/solidity/contracts/CheckBitcoinSigs.sol#L154
    0,
    outputValue.toNumber(),
    ethClient.bytesToRaw(redemptionDetails.redeemerOutputScript)
  );

  const { r, s } = await keepContractAt(deposit.keepAddress).getOrWaitForSignatureSubmittedEvent(
    redemptionDetails.digest,
    deposit.blockNumber
  );

  const pubKeyPoint = await tbtcSystem.getOrWaitForRegisteredPubkeyEvent(deposit.depositAddress, deposit.blockNumber);

  const signedTransaction = btcClient.addWitnessSignature(
    unsignedTransaction,
    0,
    r.replace('0x', ''),
    s.replace('0x', ''),
    btcClient.publicKeyPointToPublicKeyString(pubKeyPoint.x, pubKeyPoint.y)
  );

  const txHash = await btcClient.broadcastTx(signedTransaction);
  const tx = await btcClient.getTransaction(txHash);

  const log = new DepositOperationLog();
  log.txHash = tx.txid;
  log.operationType = DepositOperationLogType.REDEEM_BTC_RELEASE;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.BTC;

  await storeOperationLog(deposit, log);

  return tx;
}
