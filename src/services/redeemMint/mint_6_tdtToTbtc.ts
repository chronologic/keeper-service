import { Deposit, DepositTx } from 'keeper-db';

import { depositContractAt, vendingMachine } from '../../contracts';
import { ethClient } from '../../clients';
import priceFeed from '../priceFeed';
import { weiToSatoshi } from '../../utils';
import { IDepositTxParams } from '../depositTxHelper';

const operationType = DepositTx.Type.MINT_TDT_TO_TBTC;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  const { receipt, success, revertReason } = await ethClient.confirmTransaction(txHash);
  const tx = await ethClient.httpProvider.getTransaction(txHash);
  let txCost = ethClient.calcTotalTxCost(tx, receipt);

  const depositContract = depositContractAt(deposit.mintedDeposit.depositAddress);
  const signerFeeTbtc = await depositContract.getSignerFeeTbtc();
  const signerFeeSats = weiToSatoshi(signerFeeTbtc);
  const signerFeeEth = await priceFeed.convertSatoshiToWei(signerFeeSats);
  txCost = signerFeeEth.add(txCost);

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    revertReason,
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
