import { BigNumber } from 'ethers';

import { tbtcSystem, keepContractAt, tbtcConstants } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import {
  BlockchainType,
  DepositOperationLogDirection,
  DepositOperationLogStatus,
  DepositOperationLogType,
  IDepositContract,
  IEthTx,
} from '../../types';
import { createLogger } from '../../logger';
import { DepositOperationLog } from '../../entities/DepositOperationLog';
import { btcClient, ethClient } from '../../clients';
import { fetchWeiToUsdPrice } from '../priceFeed';
import {
  getOperationLogInStatus,
  getOperationLogsOfType,
  hasOperationLogInStatus,
  storeOperationLog,
} from './operationLogHelper';
import { ETH_MIN_CONFIRMATIONS } from '../../constants';
import { getDeposit } from './depositHelper';

const logger = createLogger('redemptionProof');

export async function ensureRedemptionProofProvided(
  deposit: Deposit,
  depositContract: IDepositContract
): Promise<Deposit> {
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

    const tx = await provideRedemptionProof(deposit, depositContract);
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
  // TODO: check tx status; 0 - failure, 1 - success
  const txReceipt = await ethClient.httpProvider.waitForTransaction(txHash, ETH_MIN_CONFIRMATIONS);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption proof for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.fromAddress = ethClient.defaultWallet.address;
  log.toAddress = deposit.depositAddress;
  log.operationType = DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_PROOF;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.ETHEREUM;
  log.txCostEthEquivalent = txReceipt.gasUsed;
  log.txCostUsdEquivalent = await fetchWeiToUsdPrice(txReceipt.gasUsed);

  await storeOperationLog(deposit, log);
}

async function provideRedemptionProof(deposit: Deposit, depositContract: IDepositContract): Promise<IEthTx> {
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();

  const btcReceptionLogs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_BTC_RECEPTION);
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
  log.fromAddress = ethClient.defaultWallet.address;
  log.toAddress = deposit.depositAddress;
  log.operationType = DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_PROOF;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.ETHEREUM;

  await storeOperationLog(deposit, log);

  return tx;
}
