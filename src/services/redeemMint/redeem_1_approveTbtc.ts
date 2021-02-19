import { Deposit, DepositTx } from 'keeper-db';

import { depositContractAt, vendingMachine } from '../../contracts';
import { ethClient } from '../../clients';
import { IDepositTxParams } from '../depositTxHelper';

const operationType = DepositTx.Type.REDEEM_APPROVE_TBTC;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  const { receipt, success, revertReason } = await ethClient.confirmTransaction(txHash);

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    revertReason,
    txCostEthEquivalent: receipt.gasUsed,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  const depositContract = depositContractAt(deposit.depositAddress);
  const redemptionCost = await depositContract.getRedemptionCost();
  const tx = await vendingMachine.approveSpendingTbtc(redemptionCost);

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
