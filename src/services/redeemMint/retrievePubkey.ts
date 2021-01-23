import { keepContractAt, depositContractAt } from '../../contracts';
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

const logger = createLogger('redemptionSig');

export async function ensurePubkeyRetrieved(deposit: Deposit): Promise<Deposit> {
  logger.info(`Ensuring pubkey provided for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain - AWAITING_SIGNER_SETUP
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.MINT_RETRIEVE_PUBKEY);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`Pubkey retrieved is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `Pubkey retrieved is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmPubkeyRetrieved(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    const tx = await retrievePubkey(deposit);
    await confirmPubkeyRetrieved(deposit, tx.hash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmPubkeyRetrieved(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for retrieving pubkey for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);

  // TODO: check tx status
  logger.info(`Got confirmations for retrieving pubkey for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(receipt, null, 2));

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.operationType = DepositOperationLogType.MINT_RETRIEVE_PUBKEY;
  log.status = success ? DepositOperationLogStatus.CONFIRMED : DepositOperationLogStatus.ERROR;
  log.direction = DepositOperationLogDirection.OUT;
  log.blockchainType = BlockchainType.ETH;
  log.txCostEthEquivalent = receipt.gasUsed;
  log.txCostUsdEquivalent = await priceFeed.convertWeiToUsd(receipt.gasUsed);

  await storeOperationLog(deposit, log);
}

async function retrievePubkey(deposit: Deposit): Promise<IEthTx> {
  const keepContract = keepContractAt(deposit.mintedDeposit.keepAddress);
  logger.info(`Waiting for PublicKeyPublished event for deposit ${deposit.mintedDeposit.depositAddress}...`);
  await keepContract.getOrWaitForPublicKeyPublishedEvent(deposit.mintedDeposit.blockNumber);

  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  logger.info(`Retrieving signer pubkey for deposit ${deposit.mintedDeposit.depositAddress}...`);
  const tx = await depositContract.retrieveSignerPubkey();

  logger.debug(`Retrieve signer pubkey tx:\n${JSON.stringify(tx, null, 2)}`);

  const log = new DepositOperationLog();
  log.txHash = tx.hash;
  log.operationType = DepositOperationLogType.MINT_RETRIEVE_PUBKEY;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.ETH;

  await storeOperationLog(deposit, log);

  return tx;
}
