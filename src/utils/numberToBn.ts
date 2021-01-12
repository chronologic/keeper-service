import { BigNumber } from 'ethers';
import { BTC_DECIMALS, ETH_DECIMALS } from '../constants';

export function numberToBnEth(num: number): BigNumber {
  return numberToBn(num, ETH_DECIMALS);
}

export function numberToBnBtc(num: number): BigNumber {
  return numberToBn(num, BTC_DECIMALS);
}

export function numberToBn(num: number, decimals = ETH_DECIMALS): BigNumber {
  return BigNumber.from(num).mul(BigNumber.from(10).pow(decimals));
}
