import { BigNumber, BigNumberish } from 'ethers';
import { BTC_DECIMALS, ETH_DECIMALS } from '../constants';

export function satoshiToWei(satoshi: BigNumberish): BigNumber {
  return normalizeBigNumber(BigNumber.from(satoshi), BTC_DECIMALS, ETH_DECIMALS);
}

export function weiToSatoshi(wei: BigNumberish): BigNumber {
  return normalizeBigNumber(BigNumber.from(wei), ETH_DECIMALS, BTC_DECIMALS);
}

export function normalizeBigNumber(bn: BigNumber, decimalsIn: number, decimalsOut = 18): BigNumber {
  const decimalsDiff = decimalsOut - decimalsIn;

  if (decimalsDiff > 0) {
    return BigNumber.from(bn.toString() + '0'.repeat(decimalsDiff));
  }
  if (decimalsDiff < 0) {
    const bnString = bn.toString();
    return BigNumber.from(bnString.substring(0, bnString.length + decimalsDiff) || '0');
  }

  return bn;
}
