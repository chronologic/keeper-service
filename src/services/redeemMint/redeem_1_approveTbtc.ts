import { depositContractAt, vendingMachine } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { createLogger } from '../../logger';
import { ethClient } from '../../clients';
import { DepositTx } from '../../entities';
import { IDepositTxParams } from './depositTxHelper';

const logger = createLogger('redeem_1_approveTbtc');
const operationType = DepositTx.Type.REDEEM_APPROVE_TBTC;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for TBTC spending for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);
  logger.info(`Got confirmations for TBTC spending for deposit ${deposit.depositAddress}.`);

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
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
