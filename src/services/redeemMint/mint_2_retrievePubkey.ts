import { Deposit, DepositTx } from 'keeper-db';

import { keepContractAt, depositContractAt } from '../../contracts';
import { createLogger } from '../../logger';
import { ethClient } from '../../clients';
import { IDepositTxParams } from '../depositTxHelper';

const logger = createLogger('mint_2_retrievePubkey');
const operationType = DepositTx.Type.MINT_RETRIEVE_PUBKEY;

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
  const keepContract = keepContractAt(deposit.mintedDeposit.keepAddress);
  logger.debug(`Waiting for PublicKeyPublished event for deposit ${deposit.mintedDeposit.depositAddress}...`);
  await keepContract.getOrWaitForPublicKeyPublishedEvent(deposit.mintedDeposit.blockNumber);

  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  logger.debug(`Retrieving signer pubkey for deposit ${deposit.mintedDeposit.depositAddress}...`);
  const tx = await depositContract.retrieveSignerPubkey();
  logger.debug(`Retrieved signer pubkey tx for deposit ${deposit.mintedDeposit.depositAddress}`, tx);

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
  expectedStatusCode: Deposit.Status.AWAITING_SIGNER_SETUP,
};
