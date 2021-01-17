import { BigNumber } from 'ethers';
import { vendingMachine, deposit as depositContract } from '../contracts';
import { Deposit } from '../entities/Deposit';
import { bnToNumber } from '../utils/bnToNumber';
import { satoshiToWei } from '../utils/normalizeBigNumber';

export default async function init(): Promise<any> {
  console.log('init');
}

// step 0
async function approveSpendingTbtc(deposit: Deposit): Promise<void> {
  const redemptionFee = await depositContract.getOwnerRedemptionTbtcRequirementAt(deposit.depositAddress);
  const redemptionCost = satoshiToWei(deposit.lotSizeSatoshis).add(redemptionFee);
  console.log(redemptionCost);
  console.log(redemptionCost.toString());
  console.log(bnToNumber(redemptionCost));
  const tx = await vendingMachine.approveSpendingTbtc(redemptionCost);
  console.log(tx);
}

const deposit = new Deposit();
deposit.depositAddress = '0x085c5853d98e9311814131c4bb5928696bc82acf';
deposit.lotSizeSatoshis = BigNumber.from(100000000);
approveSpendingTbtc(deposit);
