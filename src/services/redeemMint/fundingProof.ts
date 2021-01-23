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

const logger = createLogger('fundingProof');

export async function ensureFundingProofProvided(deposit: Deposit): Promise<Deposit> {
  logger.info(`Ensuring funding proof provided for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain - AWAITING_BTC_FUNDING_PROOF
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.MINT_PROVIDE_FUNDING_PROOF);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`Funding proof is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `Redemption proof is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmFundingProofProvided(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    const tx = await provideFundingProof(deposit);
    await confirmFundingProofProvided(deposit, tx.hash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmFundingProofProvided(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for funding proof for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);

  // TODO: check tx status
  logger.info(`Got confirmations for funding proof for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(receipt, null, 2));

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.operationType = DepositOperationLogType.MINT_PROVIDE_FUNDING_PROOF;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = success ? DepositOperationLogStatus.CONFIRMED : DepositOperationLogStatus.ERROR;
  log.blockchainType = BlockchainType.ETH;
  log.txCostEthEquivalent = receipt.gasUsed;
  log.txCostUsdEquivalent = await priceFeed.convertWeiToUsd(receipt.gasUsed);

  await storeOperationLog(deposit, log);
}

async function provideFundingProof(deposit: Deposit): Promise<IEthTx> {
  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();

  const btcFundLogs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.MINT_FUND_BTC);
  const btcFundLog = getOperationLogInStatus(btcFundLogs, DepositOperationLogStatus.CONFIRMED);

  // the system always puts the funding tx in position 0
  const outputPosition = 0;
  const proofArgs = await btcClient.constructFundingProof(btcFundLog.txHash, outputPosition, minConfirmations);

  // this may fail with "not at current or previous difficulty"
  // DepositUtils.sol contract will compare submitted headers with current and previous difficulty
  // and will revert if not a match
  const tx = await depositContract.provideBTCFundingProof(proofArgs);

  logger.debug(`Redemption proof tx:\n${JSON.stringify(tx, null, 2)}`);

  const log = new DepositOperationLog();
  log.txHash = tx.hash;
  log.operationType = DepositOperationLogType.MINT_PROVIDE_FUNDING_PROOF;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.ETH;

  await storeOperationLog(deposit, log);

  return tx;
}
