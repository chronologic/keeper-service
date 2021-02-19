import { Deposit, DepositTx } from 'keeper-db';

import { tbtcSystem, depositFactory } from '../../contracts';
import { ethClient } from '../../clients';
import { IDepositTxParams } from '../depositTxHelper';
import depositHelper from '../depositHelper';

const operationType = DepositTx.Type.MINT_CREATE_DEPOSIT;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  const { receipt, success, revertReason } = await ethClient.confirmTransaction(txHash);
  const tx = await ethClient.httpProvider.getTransaction(txHash);

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
    revertReason,
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
