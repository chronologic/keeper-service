import { keepContractAt, depositContractAt } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { createLogger } from '../../logger';
import { ethClient } from '../../clients';
import { DepositTx } from '../../entities';
import { IDepositTxParams } from '../depositTxHelper';

const logger = createLogger('mint_2_retrievePubkey');
const operationType = DepositTx.Type.MINT_RETRIEVE_PUBKEY;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for retrieving pubkey for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);

  // TODO: check tx status
  logger.info(`Got confirmations for retrieving pubkey for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(receipt, null, 2));

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    txCostEthEquivalent: receipt.gasUsed,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  const keepContract = keepContractAt(deposit.mintedDeposit.keepAddress);
  logger.info(`Waiting for PublicKeyPublished event for deposit ${deposit.mintedDeposit.depositAddress}...`);
  await keepContract.getOrWaitForPublicKeyPublishedEvent(deposit.mintedDeposit.blockNumber);

  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  logger.info(`Retrieving signer pubkey for deposit ${deposit.mintedDeposit.depositAddress}...`);
  const tx = await depositContract.retrieveSignerPubkey();

  logger.debug(`Retrieve signer pubkey tx:\n${JSON.stringify(tx, null, 2)}`);

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
