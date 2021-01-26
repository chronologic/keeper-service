import { tbtcConstants, depositContractAt } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { createLogger } from '../../logger';
import { btcClient, ethClient } from '../../clients';
import { DepositTx } from '../../entities';
import depositTxHelper, { IDepositTxParams } from '../depositTxHelper';

const logger = createLogger('mint_4_fundingProof');
const operationType = DepositTx.Type.MINT_PROVIDE_FUNDING_PROOF;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for funding proof for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);

  // TODO: check tx status
  logger.info(`Got confirmations for funding proof for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(receipt, null, 2));

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
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

  logger.debug(`Redemption proof tx:\n${JSON.stringify(tx, null, 2)}`);

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
