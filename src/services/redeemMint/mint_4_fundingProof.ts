import { Deposit, DepositTx } from 'keeper-db';

import { tbtcConstants, depositContractAt } from '../../contracts';
import { createLogger } from '../../logger';
import { btcClient, ethClient } from '../../clients';
import depositTxHelper, { IDepositTxParams } from '../depositTxHelper';
import { MINUTE_MILLIS } from '../../constants';

const logger = createLogger('mint_4_fundingProof');
const operationType = DepositTx.Type.MINT_PROVIDE_FUNDING_PROOF;

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
  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();

  const btcFundDepositTx = await depositTxHelper.getConfirmedTxOfType(deposit.id, DepositTx.Type.MINT_FUND_BTC);

  // the system always puts the funding tx in position 0
  const outputPosition = 0;
  const proofArgs = await btcClient.constructFundingProof(btcFundDepositTx.txHash, outputPosition, minConfirmations);

  // this may fail with "not at current or previous difficulty"
  // DepositUtils.sol contract will compare submitted headers with current and previous difficulty
  // and will revert if not a match
  const tx = await depositContract.provideBTCFundingProof(proofArgs);

  logger.debug(`Redemption proof tx for ${deposit.depositAddress}:`, tx);

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
  maxRetries: 10,
  retryDelay: 10 * MINUTE_MILLIS,
};
