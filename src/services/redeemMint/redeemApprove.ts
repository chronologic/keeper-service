import { tbtcToken, vendingMachine } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import {
  BlockchainType,
  DepositOperationLogDirection,
  DepositOperationLogStatus,
  DepositOperationLogType,
  IDepositContract,
  ITx,
} from '../../types';
import { createLogger } from '../../logger';
import { bnToNumber } from '../../utils';
import { DepositOperationLog } from '../../entities/DepositOperationLog';
import { ethClient } from '../../clients';
import { fetchWeiToUsdPrice } from '../priceFeed';
import { ETH_MIN_CONFIRMATIONS } from '../../constants';
import {
  getOperationLogInStatus,
  getOperationLogsOfType,
  hasOperationLogInStatus,
  storeOperationLog,
} from './operationLogHelper';

const logger = createLogger('redeemApprove');

export async function ensureApproveSpendingTbtc(deposit: Deposit, depositContract: IDepositContract): Promise<void> {
  logger.info(`Ensuring tbtc spending is approved for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain - ACTIVE / COURTESY_CALL
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_APPROVE_TBTC);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`Tbtc spending is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return;
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `Tbtc spending is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmApproveSpendingTbtc(deposit, broadcastedLog.txHash);
      return;
    }

    const tx = await approveSpendingTbtc(deposit, depositContract);
    await confirmApproveSpendingTbtc(deposit, tx.hash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
}

async function confirmApproveSpendingTbtc(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for TBTC spending for deposit ${deposit.depositAddress}...`);
  const res = await ethClient.httpProvider.waitForTransaction(txHash, ETH_MIN_CONFIRMATIONS);
  console.log(res);
  // TODO: check tx status
  logger.info(`Got confirmations for TBTC spending for deposit ${deposit.depositAddress}.`);

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.fromAddress = ethClient.getMainAddress();
  log.toAddress = tbtcToken.contract.address;
  log.operationType = DepositOperationLogType.REDEEM_APPROVE_TBTC;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.ETHEREUM;
  log.txCostEthEquivalent = res.gasUsed;
  log.txCostUsdEquivalent = await fetchWeiToUsdPrice(res.gasUsed);

  await storeOperationLog(deposit, log);
}

async function approveSpendingTbtc(deposit: Deposit, depositContract: IDepositContract): Promise<ITx> {
  const redemptionCost = await depositContract.getRedemptionCost();
  console.log(redemptionCost);
  console.log(redemptionCost.toString());
  console.log(bnToNumber(redemptionCost));
  const tx = await vendingMachine.approveSpendingTbtc(redemptionCost);
  console.log(tx);

  const log = new DepositOperationLog();
  log.blockchainType = BlockchainType.ETHEREUM;
  log.txHash = tx.hash;
  log.fromAddress = ethClient.getMainAddress();
  log.toAddress = tbtcToken.contract.address;
  log.operationType = DepositOperationLogType.REDEEM_APPROVE_TBTC;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;

  await storeOperationLog(deposit, log);

  return tx;
}
