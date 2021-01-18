import { BigNumber } from 'ethers';
import { getConnection } from 'typeorm';

import { vendingMachine, depositContractAt, keepContractAt, depositFactory } from '../contracts';
import { Deposit } from '../entities/Deposit';
import { BlockchainType, DepositOperationLogType, DepositStatus, IDepositContract } from '../types';
import { createLogger } from '../logger';
import { bnToNumber, satoshiToWei } from '../utils';
import { DepositOperationLog } from '../entities/DepositOperationLog';
import { ethClient } from '../clients';
import { fetchWeiToUsdPrice } from './priceFeed';

const logger = createLogger('redemption');
const MIN_CONFIRMATIONS = 2;

async function init(): Promise<any> {
  console.log('init');
  // getDeposit('0xd7708a3c85191fc64ebd5f1015eb02dfb0f7eca4');
  checkForDepositToProcess();
}

async function scheduleProcessDeposits() {
  console.log('schedule');
}

async function checkForDepositToProcess(): Promise<void> {
  const deposit = await getDepositToProcess();

  if (deposit) {
    await processDeposit(deposit);
    checkForDepositToProcess();
  }
}

async function getDepositToProcess(): Promise<Deposit> {
  const connection = getConnection();
  const deposits = await connection.createEntityManager().find(Deposit, {
    where: { statusCode: [DepositStatus.KEEPER_QUEUED_FOR_REDEMPTION, DepositStatus.KEEPER_REDEEMING] },
    order: { statusCode: 'DESC', createDate: 'ASC' },
  });

  // TODO: order by collateralization %

  logger.info(`Found ${deposits.length} deposits to process`);

  return deposits[0];
}

async function processDeposit(deposit: Deposit): Promise<void> {
  // TODO: change deposit state to REDEEMING
  const depositContract = depositContractAt(deposit.depositAddress);
  const keepContract = keepContractAt(deposit.keepAddress);

  await maybeApproveSpendingTbtc(deposit, depositContract);
  // try resume approve spending
  // try resume
}

async function maybeApproveSpendingTbtc(deposit: Deposit, depositContract: IDepositContract): Promise<void> {
  try {
    // TODO: double check status on blockchain
    const logs = await getOperationLogs(deposit.id);
    if (hasOperationLogType(logs, DepositOperationLogType.REDEEM_APPROVE_TBTC_CONFIRMED)) {
      return;
    }

    const approveBroadcastedLog = getOperationLogByType(logs, DepositOperationLogType.REDEEM_APPROVE_TBTC_BROADCASTED);
    if (approveBroadcastedLog) {
      await confirmApproveSpendingTbtc(deposit, approveBroadcastedLog.txHash);
      return;
    }

    const txHash = await approveSpendingTbtc(deposit, depositContract);
    await confirmApproveSpendingTbtc(deposit, txHash);
  } catch (e) {
    // lol
  } finally {
    // update total redemption cost
  }
}

async function confirmApproveSpendingTbtc(deposit: Deposit, txHash: string): Promise<void> {
  const res = await ethClient.httpProvider.waitForTransaction(txHash, MIN_CONFIRMATIONS);
  console.log(res);

  const log = new DepositOperationLog();
  log.txHash = txHash;
  log.fromAddress = ethClient.getMainAddress();
  log.toAddress = await depositFactory.getTbtcTokenAddress();
  log.operationType = DepositOperationLogType.REDEEM_APPROVE_TBTC_CONFIRMED;
  log.blockchainType = BlockchainType.ETHEREUM;
  log.txCostEthEquivalent = res.gasUsed;
  log.txCostUsdEquivalent = await fetchWeiToUsdPrice(res.gasUsed);

  await storeOperationLog(deposit, log);
}

async function approveSpendingTbtc(deposit: Deposit, depositContract: IDepositContract): Promise<string> {
  const redemptionCost = await depositContract.getRedemptionCost();
  console.log(redemptionCost);
  console.log(redemptionCost.toString());
  console.log(bnToNumber(redemptionCost));
  const tx = await vendingMachine.approveSpendingTbtc(redemptionCost);
  console.log(tx);

  const log = new DepositOperationLog();
  log.txHash = tx;
  log.fromAddress = ethClient.getMainAddress();
  log.toAddress = await depositFactory.getTbtcTokenAddress();
  log.operationType = DepositOperationLogType.REDEEM_APPROVE_TBTC_BROADCASTED;
  log.blockchainType = BlockchainType.ETHEREUM;

  await storeOperationLog(deposit, log);

  return tx;
}

async function getOperationLogs(depositId: number): Promise<DepositOperationLog[]> {
  const logs = await getConnection().createEntityManager().find(DepositOperationLog, { depositId });

  return logs;
}

function hasOperationLogType(logs: DepositOperationLog[], logType: DepositOperationLogType): boolean {
  return !!getOperationLogByType(logs, logType);
}

function getOperationLogByType(logs: DepositOperationLog[], logType: DepositOperationLogType): DepositOperationLog {
  return logs.find((l) => l.operationType === logType);
}

async function storeOperationLog(deposit: Deposit, log: DepositOperationLog): Promise<DepositOperationLog> {
  const res = await getConnection()
    .createEntityManager()
    .save(DepositOperationLog, {
      ...log,
      deposit,
    });

  return res;
}

// const deposit = new Deposit();
// deposit.depositAddress = '0xd7708a3c85191fc64ebd5f1015eb02dfb0f7eca4';
// deposit.lotSizeSatoshis = BigNumber.from(100000000);
// approveSpendingTbtc(deposit);

async function getDeposit(address: string): Promise<Deposit> {
  const conn = await getConnection();
  const manager = conn.createEntityManager();

  const deposit = await manager.findOne(Deposit, {
    where: { depositAddress: address },
  });

  console.log(deposit, JSON.stringify(deposit));

  return deposit;
}

export default { init };
