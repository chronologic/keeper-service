import { getConnection, Deposit, DepositTx } from 'keeper-db';
import BN from 'bn.js';

import { vendingMachine, depositContractAt, tbtcConstants } from '../../contracts';
import { createLogger } from '../../logger';
import { btcClient, ethClient } from '../../clients';
import { IDepositTxParams } from '../depositTxHelper';

const logger = createLogger('redeem_2_requestRedemption');
const operationType = DepositTx.Type.REDEEM_REDEMPTION_REQUEST;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  const { receipt, success, revertReason } = await ethClient.confirmTransaction(txHash);

  const redemptionFeeEth = await depositContractAt(deposit.depositAddress).getRedemptionFee();
  const txCost = receipt.gasUsed.add(redemptionFeeEth);

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    revertReason,
    txCostEthEquivalent: txCost,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  const depositContract = depositContractAt(deposit.depositAddress);
  const redemptionAddressIndex = deposit.redemptionAddressIndex || (await getNextBtcAddressIndex());
  const redemptionAddress = deposit.redemptionAddress || btcClient.getAddress(redemptionAddressIndex);
  const redeemerOutputScript = btcClient.addressToRedeemerScript(redemptionAddress);
  // TODO: add check for 'inVendingMachine' (see tbtc.js)
  // TODO: check tbtc balance
  const utxoValue = await depositContract.getUtxoValue();
  const estimatedFee = await btcClient.estimateSendFeeFromOneUtxo(utxoValue, redemptionAddress);
  const minFee = await tbtcConstants.getMinRedemptionFee();
  const txFee = Math.max(estimatedFee, minFee);
  const outputValue = new BN(utxoValue).sub(new BN(txFee.toString()));
  const outputValueBytes = outputValue.toArrayLike(Buffer, 'le', 8);

  logger.debug(`Sending request redemption tx for deposit ${deposit.depositAddress} with params`, {
    address: deposit.depositAddress,
    redemptionAddress,
    outputValueBytes: outputValueBytes.toString(),
  });

  logger.debug(`Requesting redemption for deposit ${deposit.depositAddress}...`);
  const tx = await vendingMachine.tbtcToBtc(deposit.depositAddress, outputValueBytes, redeemerOutputScript);
  logger.debug(`Requested redemption tx for deposit ${deposit.depositAddress}`, tx);

  await storeRedemptionAddress(deposit, redemptionAddress, redemptionAddressIndex);

  return {
    operationType,
    txHash: tx.hash,
    status: DepositTx.Status.BROADCASTED,
  };
}

async function getNextBtcAddressIndex(): Promise<number> {
  const [{ max }] = await getConnection()
    .createQueryBuilder()
    .select('MAX("redemptionAddressIndex") as max')
    .from(Deposit, 'd')
    .execute();

  return (max || 0) + 1;
}

async function storeRedemptionAddress(deposit: Deposit, address: string, index: number): Promise<void> {
  await getConnection().createEntityManager().update(
    Deposit,
    { depositAddress: deposit.depositAddress },
    {
      redemptionAddress: address,
      redemptionAddressIndex: index,
    }
  );
}

export default {
  operationType,
  confirm,
  execute,
};
