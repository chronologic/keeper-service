import { depositContractAt, tbtcConstants, tbtcSystem } from '../../contracts';
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
import { getDeposit } from '../depositHelper';
import priceFeed from '../priceFeed';

const logger = createLogger('fundBtc');

export async function ensureBtcFunded(deposit: Deposit): Promise<Deposit> {
  logger.info(`Ensuring BTC sent for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain -
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.MINT_FUND_BTC);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`BTC fund is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `BTC fund is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmBtcFunded(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    logger.info(`Funding BTC for deposit ${deposit.depositAddress}...`);
    const tx = await fundBtc(deposit);
    await confirmBtcFunded(deposit, tx.txid);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmBtcFunded(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for BTC fund for deposit ${deposit.depositAddress}...`);
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();
  const txReceipt = await btcClient.waitForConfirmations(txHash, minConfirmations);

  // TODO: check tx status
  logger.info(`Got confirmations for BTC fund for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));
  const txFee = await btcClient.getTransactionFee(txReceipt);

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.operationType = DepositOperationLogType.MINT_FUND_BTC;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.BTC;
  log.txCostEthEquivalent = await priceFeed.convertSatoshiToWei(txFee);
  log.txCostUsdEquivalent = await priceFeed.convertSatoshiToUsd(txFee);

  await storeOperationLog(deposit, log);
}

async function fundBtc(deposit: Deposit): Promise<btcClient.IRawTx> {
  logger.info(`Funding BTC for deposit ${deposit.depositAddress}...`);
  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  const lotSizeSatoshis = await depositContract.getLotSizeSatoshis();
  const { x, y } = await tbtcSystem.getOrWaitForRegisteredPubkeyEvent(
    deposit.mintedDeposit.depositAddress,
    deposit.mintedDeposit.blockNumber
  );
  const fundingAddress = btcClient.publicKeyPointToBitcoinAddress({ x, y });
  // console.log('FUNDING ADDRESS', fundingAddress, lotSizeSatoshis.toString());

  const txHash = await btcClient.send(fundingAddress, lotSizeSatoshis.toNumber());
  console.log({ txHash });
  const tx = await btcClient.getTransaction(txHash);
  console.log({ tx });

  const log = new DepositOperationLog();
  log.txHash = tx.txid;
  log.operationType = DepositOperationLogType.MINT_FUND_BTC;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.BTC;

  await storeOperationLog(deposit, log);

  return tx;
}
