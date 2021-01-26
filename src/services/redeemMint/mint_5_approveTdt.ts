import { depositToken } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { createLogger } from '../../logger';
import { ethClient } from '../../clients';
import { DepositTx } from '../../entities';
import { IDepositTxParams } from '../depositTxHelper';

const logger = createLogger('mint_5_approveTdt');
const operationType = DepositTx.Type.MINT_APPROVE_TDT;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for TDT approve and call for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);
  logger.info(`Got confirmations for TDT approve and call for deposit ${deposit.depositAddress}.`);

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    txCostEthEquivalent: receipt.gasUsed,
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
