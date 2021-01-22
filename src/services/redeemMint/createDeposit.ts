import { tbtcSystem, depositFactory } from '../../contracts';
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
import priveFeed from '../priceFeed';
import {
  getOperationLogInStatus,
  getOperationLogsOfType,
  hasOperationLogInStatus,
  storeOperationLog,
} from './operationLogHelper';
import { buildAndStoreDepoist, getDeposit, storeDeposit } from '../depositHelper';

const logger = createLogger('createDeposit');

export async function ensureDepositCreated(deposit: Deposit, depositContract: IDepositContract): Promise<Deposit> {
  logger.info(`Ensuring deposit created for previous deposit ${deposit.depositAddress}...`);
  try {
    // TODO: double check status on blockchain
    // TODO: check balances
    const logs = await getOperationLogsOfType(deposit.id, DepositOperationLogType.MINT_CREATE_DEPOSIT);
    if (hasOperationLogInStatus(logs, DepositOperationLogStatus.CONFIRMED)) {
      logger.info(`Deposit creation is ${DepositOperationLogStatus.CONFIRMED} for deposit ${deposit.depositAddress}.`);
      return getDeposit(deposit.depositAddress);
    }

    const broadcastedLog = getOperationLogInStatus(logs, DepositOperationLogStatus.BROADCASTED);
    if (broadcastedLog) {
      logger.info(
        `Deposit creation is in ${DepositOperationLogStatus.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
      );
      await confirmDepositCreated(deposit, broadcastedLog.txHash);
      return getDeposit(deposit.depositAddress);
    }

    const tx = await createDeposit(deposit);
    await confirmDepositCreated(deposit, tx.hash);
  } catch (e) {
    // TODO: handle errors inside functions above
    console.log(e);
    throw e;
  } finally {
    // TODO: update total redemption cost
  }
  return getDeposit(deposit.depositAddress);
}

async function confirmDepositCreated(deposit: Deposit, txHash: string): Promise<void> {
  logger.info(`Waiting for confirmations for deposit creation for deposit ${deposit.depositAddress}...`);
  const txReceipt = await ethClient.confirmTransaction(txHash);
  const tx = await ethClient.httpProvider.getTransaction(txHash);

  logger.info(`Got confirmations for deposit creation for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

  const createdEvent = tbtcSystem.findLog(txReceipt.logs, 'Created');
  const [createdDepositAddress]: [string] = createdEvent.args as any;
  console.log({ createdDepositAddress });

  // eslint-disable-next-line no-param-reassign
  deposit.mintedDeposit = await buildAndStoreDepoist(createdDepositAddress, txReceipt.blockNumber);

  await storeDeposit(deposit);

  const log = new DepositOperationLog();
  const txCost = txReceipt.gasUsed.add(tx.value);
  log.txHash = txHash;
  log.fromAddress = ethClient.defaultWallet.address;
  log.toAddress = txReceipt.to;
  log.operationType = DepositOperationLogType.MINT_CREATE_DEPOSIT;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.CONFIRMED;
  log.blockchainType = BlockchainType.ETHEREUM;
  log.txCostEthEquivalent = txCost;
  log.txCostUsdEquivalent = await priveFeed.convertWeiToUsd(txCost);

  await storeOperationLog(deposit, log);
}

async function createDeposit(deposit: Deposit): Promise<IEthTx> {
  const creationCost = await tbtcSystem.getNewDepositFeeEstimate();
  // TODO: increase gas price?
  const tx = await depositFactory.createDeposit(deposit.lotSizeSatoshis, creationCost);

  const log = new DepositOperationLog();
  log.txHash = tx.hash;
  log.fromAddress = ethClient.defaultWallet.address;
  log.toAddress = depositFactory.contract.address;
  log.operationType = DepositOperationLogType.MINT_CREATE_DEPOSIT;
  log.direction = DepositOperationLogDirection.OUT;
  log.status = DepositOperationLogStatus.BROADCASTED;
  log.blockchainType = BlockchainType.ETHEREUM;

  await storeOperationLog(deposit, log);

  return tx;
}
