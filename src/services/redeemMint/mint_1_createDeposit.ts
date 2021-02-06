import { Deposit, DepositTx } from 'keeper-db';

import { tbtcSystem, depositFactory } from '../../contracts';
import { createLogger } from '../../logger';
import { ethClient } from '../../clients';
import { IDepositTxParams } from '../depositTxHelper';
import depositHelper from '../depositHelper';

const logger = createLogger('mint_1_createDeposit');
const operationType = DepositTx.Type.MINT_CREATE_DEPOSIT;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for deposit creation for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);
  const tx = await ethClient.httpProvider.getTransaction(txHash);

  logger.info(`Got confirmations for deposit creation for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(receipt, null, 2));

  const createdEvent = tbtcSystem.findLog(receipt.logs, 'Created');
  const [createdDepositAddress]: [string] = createdEvent.args as any;

  // eslint-disable-next-line no-param-reassign
  deposit.mintedDeposit = await depositHelper.buildAndStore(createdDepositAddress, receipt.blockNumber);

  await depositHelper.store(deposit);

  const txCost = receipt.gasUsed.add(tx.value);

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    txCostEthEquivalent: txCost,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  const creationCost = await tbtcSystem.getNewDepositFeeEstimate();
  // TODO: increase gas price?
  const tx = await depositFactory.createDeposit(deposit.lotSizeSatoshis, creationCost);

  const txHash = tx.hash;

  return {
    operationType,
    txHash,
    status: DepositTx.Status.BROADCASTED,
  };
}

export default {
  operationType,
  confirm,
  execute,
};
