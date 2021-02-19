import { Deposit, DepositTx } from 'keeper-db';

import { tbtcConstants, depositContractAt } from '../../contracts';
import { btcClient, ethClient } from '../../clients';
import depositTxHelper, { IDepositTxParams } from '../depositTxHelper';
import { MINUTE_MILLIS } from '../../constants';

const operationType = DepositTx.Type.REDEEM_PROVIDE_REDEMPTION_PROOF;

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
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();

  const btcReceptionTx = await depositTxHelper.getConfirmedTxOfType(deposit.id, DepositTx.Type.REDEEM_BTC_RELEASE);

  const outputPosition = -1;
  const proofArgs = await btcClient.constructFundingProof(btcReceptionTx.txHash, outputPosition, minConfirmations);

  // this may fail with "not at current or previous difficulty"
  // DepositUtils.sol contract will compare submitted headers with current and previous difficulty
  // and will revert if not a match
  const tx = await depositContract.provideRedemptionProof(proofArgs);

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
  maxRetries: 10,
  retryDelay: 10 * MINUTE_MILLIS,
};
