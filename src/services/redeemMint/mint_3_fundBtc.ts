import { Deposit, DepositTx } from 'keeper-db';

import { depositContractAt, tbtcConstants, tbtcSystem } from '../../contracts';
import { btcClient } from '../../clients';
import priceFeed from '../priceFeed';
import { IDepositTxParams } from '../depositTxHelper';

const operationType = DepositTx.Type.MINT_FUND_BTC;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();
  const txReceipt = await btcClient.waitForConfirmations(txHash, minConfirmations);

  const txFee = await btcClient.getTransactionFee(txReceipt);
  const txCostEthEquivalent = await priceFeed.convertSatoshiToWei(txFee);

  return {
    operationType,
    txHash,
    status: DepositTx.Status.CONFIRMED,
    txCostEthEquivalent,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  const lotSizeSatoshis = await depositContract.getLotSizeSatoshis();
  const { x, y } = await tbtcSystem.getOrWaitForRegisteredPubkeyEvent(
    deposit.mintedDeposit.depositAddress,
    deposit.mintedDeposit.blockNumber
  );
  const fundingAddress = btcClient.publicKeyPointToBitcoinAddress({ x, y });

  const txHash = await btcClient.send(fundingAddress, lotSizeSatoshis.toNumber());

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
