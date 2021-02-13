import { Deposit, DepositTx } from 'keeper-db';

import { keepContractAt, tbtcConstants, tbtcSystem } from '../../contracts';
import { createLogger } from '../../logger';
import { btcClient, ethClient } from '../../clients';
import priceFeed from '../priceFeed';
import depositTxHelper, { IDepositTxParams } from '../depositTxHelper';

const logger = createLogger('redeem_4_btcRelease');
const operationType = DepositTx.Type.REDEEM_BTC_RELEASE;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for BTC reception for deposit ${deposit.depositAddress}...`);
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();
  const txReceipt = await btcClient.waitForConfirmations(txHash, minConfirmations);
  const txFee = await btcClient.getTransactionFee(txReceipt);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption sig for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

  const txCostEthEquivalent = await priceFeed.convertSatoshiToWei(txFee);

  return {
    operationType,
    txHash,
    status: DepositTx.Status.CONFIRMED,
    txCostEthEquivalent,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  logger.info(`Releasing BTC for deposit ${deposit.depositAddress}...`);

  // TODO: add debug logs for each step
  logger.debug(`Fetching redemption tx for deposit ${deposit.depositAddress}...`);
  const redemptionTx = await depositTxHelper.getConfirmedTxOfType(deposit.id, DepositTx.Type.REDEEM_REDEMPTION_REQUEST);
  logger.debug(`Fetched redemption tx for deposit ${deposit.depositAddress}.`, redemptionTx);

  logger.debug(`Fetching redemption details for deposit ${deposit.depositAddress} tx ${redemptionTx.txHash}...`);
  const redemptionDetails = await tbtcSystem.getRedemptionDetailsFromEvent(
    redemptionTx.txHash,
    deposit.depositAddress,
    deposit.blockNumber
  );
  logger.debug(
    `Fetched redemption details for deposit ${deposit.depositAddress} tx ${redemptionTx.txHash}.`,
    redemptionDetails
  );

  const outputValue = redemptionDetails.utxoValue.sub(redemptionDetails.requestedFee);
  const unsignedTransaction = btcClient.constructOneInputOneOutputWitnessTransaction(
    redemptionDetails.outpoint.replace('0x', ''),
    // We set sequence to `0` to be able to replace by fee. It reflects
    // bitcoin-spv:
    // https://github.com/summa-tx/bitcoin-spv/blob/2a9d594d9b14080bdbff2a899c16ffbf40d62eef/solidity/contracts/CheckBitcoinSigs.sol#L154
    0,
    outputValue.toNumber(),
    ethClient.bytesToRaw(redemptionDetails.redeemerOutputScript)
  );

  logger.debug(`Fetching signature submitted event for deposit ${deposit.depositAddress}...`);
  const { r, s } = await keepContractAt(deposit.keepAddress).getOrWaitForSignatureSubmittedEvent(
    redemptionDetails.digest,
    deposit.blockNumber
  );
  logger.debug(`Fetched signature submitted event for deposit ${deposit.depositAddress}.`, { r, s });

  logger.debug(`Fetching registered pubkey event for deposit ${deposit.depositAddress}...`);
  const pubKeyPoint = await tbtcSystem.getOrWaitForRegisteredPubkeyEvent(deposit.depositAddress);
  logger.debug(`Fetched registered pubkey event for deposit ${deposit.depositAddress}.`, pubKeyPoint);

  const signedTransaction = btcClient.addWitnessSignature(
    unsignedTransaction,
    0,
    r.replace('0x', ''),
    s.replace('0x', ''),
    btcClient.publicKeyPointToPublicKeyString(pubKeyPoint.x, pubKeyPoint.y)
  );

  logger.debug(`Broadcasting btc release tx for deposit ${deposit.depositAddress}...`);
  const txHash = await btcClient.broadcastTx(signedTransaction);
  logger.debug(`Broadcasted btc release tx for deposit ${deposit.depositAddress}.`, txHash);

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
