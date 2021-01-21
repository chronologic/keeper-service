import { getConnection } from 'typeorm';
import BN from 'bn.js';

import { vendingMachine, depositContractAt } from '../../contracts';
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

const logger = createLogger('requestRedemption');

export async function ensureRedemptionRequested(deposit: Deposit, depositContract: IDepositContract): Promise<ITx> {
  logger.info(`Ensuring redemption requested for deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain - ACTIVE / COURTESY_CALL
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.REDEEM_REDEMPTION_REQUEST);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(
        `Redemption request is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`
      );
      return;
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `Redemption request is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmRedemptionRequested(deposit, broadcastedLog.txHash);
      return;
    }

    const tx = await requestRedemption(deposit, depositContract);
    await confirmRedemptionRequested(deposit, tx.hash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
}

async function confirmRedemptionRequested(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for redemption request for deposit ${deposit.depositAddress}...`);
  const txReceipt = await ethClient.httpProvider.waitForTransaction(txHash, ETH_MIN_CONFIRMATIONS);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption request for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

  const redemptionCostEth = await depositContractAt(deposit.depositAddress).getRedemptionCost();
  const redemptionCostUsd = await fetchWeiToUsdPrice(redemptionCostEth);
  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.fromAddress = ethClient.getMainAddress();
  log.toAddress = vendingMachine.contract.address;
  log.operationType = DepositOperationLogType.REDEEM_REDEMPTION_REQUEST;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.ETHEREUM;
  log.txCostEthEquivalent = txReceipt.gasUsed.add(redemptionCostEth);
  const txUsdCost = await fetchWeiToUsdPrice(txReceipt.gasUsed);
  log.txCostUsdEquivalent = txUsdCost + redemptionCostUsd;

  await storeOperationLog(deposit, log);
}

async function requestRedemption(deposit: Deposit, depositContract: IDepositContract): Promise<ITx> {
  const redemptionAddressIndex = deposit.redemptionAddressIndex || (await getNextBtcAddressIndex());
  const redemptionAddress = deposit.redemptionAddress || btcClient.getAddress(redemptionAddressIndex);
  const rawOutputScript = btcClient.addressToScript(redemptionAddress);
  const redeemerOutputScript = `0x${Buffer.concat([Buffer.from([rawOutputScript.length]), rawOutputScript]).toString(
    'hex'
  )}`;
  // TODO: add check for 'inVendingMachine' (see tbtc.js)
  // TODO: check tbtc balance
  const utxoValue = await depositContract.getUtxoValue();
  // TODO: compare with MINIMUM_REDEMPTION_FEE from TBTCConstants contract - how to find the contract on ropsten?
  const txFee = await btcClient.estimateSendFee(utxoValue, redemptionAddress);
  const outputValue = new BN(utxoValue).sub(new BN(txFee.toString()));
  const outputValueBytes = outputValue.toArrayLike(Buffer, 'le', 8);

  logger.debug(
    `Sending request redemption tx for deposit ${deposit.depositAddress} with params:\n${JSON.stringify(
      {
        address: deposit.depositAddress,
        redemptionAddress,
        outputValueBytes: outputValueBytes.toString(),
      },
      null,
      2
    )}`
  );

  const tx = await vendingMachine.tbtcToBtc(deposit.depositAddress, outputValueBytes, redeemerOutputScript);

  logger.debug(`Request redemption tx:\n${JSON.stringify(tx, null, 2)}`);

  await storeRedemptionAddress(deposit, redemptionAddress, redemptionAddressIndex);

  const log = new DepositOperationLog();
  log.txHash = tx.hash;
  log.fromAddress = ethClient.getMainAddress();
  log.toAddress = vendingMachine.contract.address;
  log.operationType = DepositOperationLogType.REDEEM_REDEMPTION_REQUEST;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.ETHEREUM;

  await storeOperationLog(deposit, log);

  return tx;
}

async function getNextBtcAddressIndex(): Promise<number> {
  const [{ max }] = await getConnection()
    .createQueryBuilder()
    .select('MAX("redemptionAddressIndex") as max')
    .from(Deposit, 'd')
    .execute();

  return (max || 0) + 1;
}

async function storeRedemptionAddress(deposit: Deposit, address: string, index: number): Promise<void> {
  await getConnection().createEntityManager().update(
    Deposit,
    { depositAddress: deposit.depositAddress },
    {
      redemptionAddress: address,
      redemptionAddressIndex: index,
    }
  );
}
