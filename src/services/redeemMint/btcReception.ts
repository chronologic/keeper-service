import { BigNumber } from 'ethers';

import { tbtcSystem, keepContractAt } from '../../contracts';
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

const logger = createLogger('redemptionSig');

export async function ensureBtcReceived(deposit: Deposit): Promise<ITx> {
  logger.info(`Ensuring BTC received for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain -
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_BTC_RECEPTION);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`BTC reception is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return;
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    const redemptionSigLogs = await getOperationLogsOfType(
      deposit.id,
      DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_SIG
    );
    if (broadcastedLog) {
      logger.info(
        `Redemption sig is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmBtcReceived(deposit, broadcastedLog.txHash);
      return;
    }

    // const tx = await provideRedemptionSig(deposit, depositContract);
    // await confirmBtcReceived(deposit, tx.hash);

    // logger.info(`Confirming BTC reception for deposit ${deposit.depositAddress}...`);
    // await confirmBtcReceived(deposit, broadcastedLog.txHash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
}

async function confirmBtcReceived(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for BTC reception for deposit ${deposit.depositAddress}...`);
  const txReceipt = await btcClient.waitForTransactionToAddress(deposit.redemptionAddress);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption sig for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.fromAddress = ethClient.getMainAddress();
  log.toAddress = deposit.depositAddress;
  log.operationType = DepositOperationLogType.REDEEM_BTC_RECEPTION;
  log.direction = DepositOperationLogDirection.IN;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.BITCOIN;
  log.txCostEthEquivalent = txReceipt.gasUsed;
  log.txCostUsdEquivalent = await fetchWeiToUsdPrice(txReceipt.gasUsed);

  await storeOperationLog(deposit, log);
}
