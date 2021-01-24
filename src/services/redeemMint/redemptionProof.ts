import { tbtcConstants, depositContractAt } from '../../contracts';
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
import { btcClient, ethClient } from '../../clients';
import priceFeed from '../priceFeed';
import {
  getOperationLogInStatus,
  getOperationLogsOfType,
  hasOperationLogInStatus,
  storeOperationLog,
} from './operationLogHelper';
import { getDeposit } from '../depositHelper';

const logger = createLogger('redemptionProof');

export async function ensureRedemptionProofProvided(deposit: Deposit): Promise<Deposit> {
  logger.info(`Ensuring redemption proof provided for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain - AWAITING_WITHDRAWAL_PROOF
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_PROOF);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`Redemption proof is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `Redemption proof is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmRedemptionProofProvided(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    const tx = await provideRedemptionProof(deposit);
    await confirmRedemptionProofProvided(deposit, tx.hash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmRedemptionProofProvided(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for redemption proof for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption proof for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(receipt, null, 2));

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.operationType = DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_PROOF;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = success ? DepositOperationLogStatus.CONFIRMED : DepositOperationLogStatus.ERROR;
  log.blockchainType = BlockchainType.ETH;
  log.txCostEthEquivalent = receipt.gasUsed;
  log.txCostUsdEquivalent = await priceFeed.convertWeiToUsd(receipt.gasUsed);

  await storeOperationLog(deposit, log);
}

async function provideRedemptionProof(deposit: Deposit): Promise<IEthTx> {
  const depositContract = depositContractAt(deposit.depositAddress);
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();

  const btcReceptionLogs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_BTC_RELEASE);
  const confirmedBtcReception = getOperationLogInStatus(btcReceptionLogs, DepositOperationLogStatus.CONFIRMED);

  const outputPosition = -1;
  const proofArgs = await btcClient.constructFundingProof(
    confirmedBtcReception.txHash,
    outputPosition,
    minConfirmations
  );

  // this may fail with "not at current or previous difficulty"
  // DepositUtils.sol contract will compare submitted headers with current and previous difficulty
  // and will revert if not a match
  const tx = await depositContract.provideRedemptionProof(proofArgs);

  logger.debug(`Redemption proof tx:\n${JSON.stringify(tx, null, 2)}`);

  const log = new DepositOperationLog();
  log.txHash = tx.hash;
  log.operationType = DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_PROOF;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.ETH;

  await storeOperationLog(deposit, log);

  return tx;
}
