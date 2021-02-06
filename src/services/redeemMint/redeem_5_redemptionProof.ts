import { Deposit, DepositTx } from 'keeper-db';

import { tbtcConstants, depositContractAt } from '../../contracts';
import { createLogger } from '../../logger';
import { btcClient, ethClient } from '../../clients';
import depositTxHelper, { IDepositTxParams } from '../depositTxHelper';

const logger = createLogger('redeem_5_redemptionProof');
const operationType = DepositTx.Type.REDEEM_PROVIDE_REDEMPTION_PROOF;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for redemption proof for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption proof for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(receipt, null, 2));

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
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

  logger.debug(`Redemption proof tx:\n${JSON.stringify(tx, null, 2)}`);

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
