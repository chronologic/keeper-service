import { depositContractAt, vendingMachine } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { createLogger } from '../../logger';
import { ethClient } from '../../clients';
import priceFeed from '../priceFeed';
import { weiToSatoshi } from '../../utils';
import { DepositTx } from '../../entities';
import { IDepositTxParams } from './depositTxHelper';

const logger = createLogger('mint_6_tdtToTbtc');
const operationType = DepositTx.Type.MINT_TDT_TO_TBTC;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for TDT approve and call for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);
  logger.info(`Got confirmations for TDT approve and call for deposit ${deposit.depositAddress}.`);
  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  const signerFeeTbtc = await depositContract.getSignerFeeTbtc();
  const signerFeeSats = weiToSatoshi(signerFeeTbtc);
  const signerFeeEth = await priceFeed.convertSatoshiToWei(signerFeeSats);
  const txCost = signerFeeEth.add(receipt.gasUsed);

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    txCostEthEquivalent: txCost,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  const tx = await vendingMachine.tdtToTbtc(deposit.mintedDeposit.depositAddress);

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
