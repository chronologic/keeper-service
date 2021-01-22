import { BigNumber } from 'ethers';

import { tbtcSystem, keepContractAt } from '../../contracts';
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

export async function ensureRedemptionSigProvided(
  deposit: Deposit,
  depositContract: IDepositContract
): Promise<Deposit> {
  logger.info(`Ensuring redemption sig provided for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain - AWAITING_WITHDRAWAL_SIGNATURE
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_SIG);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`Redemption sig is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `Redemption sig is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmRedemptionSigProvided(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    const tx = await provideRedemptionSig(deposit, depositContract);
    await confirmRedemptionSigProvided(deposit, tx.hash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmRedemptionSigProvided(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for redemption sig for deposit ${deposit.depositAddress}...`);
  const txReceipt = await ethClient.confirmTransaction(txHash);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption sig for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.fromAddress = ethClient.defaultWallet.address;
  log.toAddress = deposit.depositAddress;
  log.operationType = DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_SIG;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.ETHEREUM;
  log.txCostEthEquivalent = txReceipt.gasUsed;
  log.txCostUsdEquivalent = await priceFeed.convertWeiToUsd(txReceipt.gasUsed);

  await storeOperationLog(deposit, log);
}

async function provideRedemptionSig(deposit: Deposit, depositContract: IDepositContract): Promise<IEthTx> {
  const redemptionRequestLogs = await getOperationLogsOfType(
    deposit.id,
    DepositOperationLogType.REDEEM_REDEMPTION_REQUEST
  );
  const confirmedRedemptionRequest = getOperationLogInStatus(
    redemptionRequestLogs,
    DepositOperationLogStatus.CONFIRMED
  );
  logger.info(`Fetching redemption details from event for deposit ${deposit.depositAddress}...`);
  const { digest } = await tbtcSystem.getRedemptionDetailsFromEvent(
    confirmedRedemptionRequest.txHash,
    deposit.depositAddress,
    deposit.blockNumber
  );

  logger.info(`Waiting for signature submitted from for deposit ${deposit.depositAddress}...`);
  const { r, s, recoveryID } = await keepContractAt(deposit.keepAddress).waitOnSignatureSubmittedEvent(
    digest,
    deposit.blockNumber
  );

  // A constant in the Ethereum ECDSA signature scheme, used for public key recovery [1]
  // Value is inherited from Bitcoin's Electrum wallet [2]
  // [1] https://bitcoin.stackexchange.com/questions/38351/ecdsa-v-r-s-what-is-v/38909#38909
  // [2] https://github.com/ethereum/EIPs/issues/155#issuecomment-253810938
  const ETHEREUM_ECDSA_RECOVERY_V = BigNumber.from(27);
  const v = BigNumber.from(recoveryID).add(ETHEREUM_ECDSA_RECOVERY_V);

  logger.debug(
    `Sending redemption sig tx for deposit ${deposit.depositAddress} with params:\n${JSON.stringify(
      {
        v: v.toString(),
        r: r.toString(),
        s: s.toString(),
      },
      null,
      2
    )}`
  );

  const tx = await depositContract.provideRedemptionSignature(v.toString(), r.toString(), s.toString());

  logger.debug(`Redemption sig tx:\n${JSON.stringify(tx, null, 2)}`);

  const log = new DepositOperationLog();
  log.txHash = tx.hash;
  log.fromAddress = ethClient.defaultWallet.address;
  log.toAddress = deposit.depositAddress;
  log.operationType = DepositOperationLogType.REDEEM_PROVIDE_REDEMPTION_SIG;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.ETHEREUM;

  await storeOperationLog(deposit, log);

  return tx;
}
