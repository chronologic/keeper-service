import { Deposit, DepositTx } from 'keeper-db';
import { BigNumber } from 'ethers';

import { keepContractAt, depositContractAt, tbtcSystem } from '../../contracts';
import { createLogger } from '../../logger';
import { ethClient } from '../../clients';
import { IDepositTxParams } from '../depositTxHelper';

const logger = createLogger('mint_2_retrievePubkey');
const operationType = DepositTx.Type.MINT_RETRIEVE_PUBKEY;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  const { receipt, success, revertReason } = await ethClient.confirmTransaction(txHash);
  const tx = await ethClient.httpProvider.getTransaction(txHash);

  const txCost =
    ethClient.defaultWallet.address.toLowerCase() === tx.from.toLowerCase()
      ? ethClient.calcTotalTxCost(tx, receipt)
      : BigNumber.from('0');

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

  // somebody else called retrieveSignerPubkey before the system could
  // https://etherscan.io/tx/0xd189321bd1820785452cb5568c023842ec29a97f20baf66c5241ff4347eacc91#eventlog
  // this check makes sure we can handle that case
  logger.debug(`Checking for RegisteredPubkey event for deposit ${deposit.mintedDeposit.depositAddress}...`);
  const event = await tbtcSystem.getRawRegisteredPubkeyEvent(deposit.mintedDeposit.depositAddress);
  let txHash = '';

  if (event) {
    logger.debug(`RegisteredPubkey event already exists for deposit ${deposit.mintedDeposit.depositAddress}.`);
    txHash = event.transactionHash;
  } else {
    const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
    logger.debug(`Retrieving signer pubkey for deposit ${deposit.mintedDeposit.depositAddress}...`);
    const tx = await depositContract.retrieveSignerPubkey();
    logger.debug(`Retrieved signer pubkey tx for deposit ${deposit.mintedDeposit.depositAddress}`, tx);
    txHash = tx.hash;
  }

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
