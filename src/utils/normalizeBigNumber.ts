import { BigNumber } from 'ethers';
import { BTC_DECIMALS, ETH_DECIMALS } from '../constants';

export function satoshiToWei(satoshi: BigNumber | string | number): BigNumber {
  return normalizeBigNumber(BigNumber.from(satoshi), BTC_DECIMALS, ETH_DECIMALS);
}

export function normalizeBigNumber(bn: BigNumber, decimalsIn: number, decimalsOut = 18): BigNumber {
  const decimalsDiff = decimalsOut - decimalsIn;

  return BigNumber.from(bn.toString() + '0'.repeat(decimalsDiff));
}
