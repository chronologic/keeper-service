import { depositContractAt, tbtcConstants, tbtcSystem } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { createLogger } from '../../logger';
import { btcClient } from '../../clients';
import priceFeed from '../priceFeed';
import { DepositTx } from '../../entities';
import { IDepositTxParams } from './depositTxHelper';

const logger = createLogger('mint_3_fundBtc');
const operationType = DepositTx.Type.MINT_FUND_BTC;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for BTC fund for deposit ${deposit.depositAddress}...`);
  const minConfirmations = await tbtcConstants.getMinBtcConfirmations();
  const txReceipt = await btcClient.waitForConfirmations(txHash, minConfirmations);

  // TODO: check tx status
  logger.info(`Got confirmations for BTC fund for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(txReceipt, null, 2));

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
  logger.info(`Funding BTC for deposit ${deposit.depositAddress}...`);
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
