import { Deposit, DepositTx } from 'keeper-db';

import { depositToken } from '../../contracts';
import { ethClient } from '../../clients';
import { IDepositTxParams } from '../depositTxHelper';

const operationType = DepositTx.Type.MINT_APPROVE_TDT;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  const { receipt, success, revertReason } = await ethClient.confirmTransaction(txHash);
  const tx = await ethClient.httpProvider.getTransaction(txHash);

  const txCost = ethClient.calcTotalTxCost(tx, receipt);

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    revertReason,
    txCostEthEquivalent: txCost,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  const tx = await depositToken.approve(deposit.mintedDeposit.depositAddress);

  return {
    operationType,
    txHash: tx.hash,
    status: DepositTx.Status.BROADCASTED,
  };
}

export default {
  operationType,
  confirm,
  execute,
};
