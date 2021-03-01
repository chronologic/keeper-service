import { ethers } from 'ethers';

import { ethClient } from '../clients';
import getAbiAndAddress from './getKeepAbiAndAddress';

const { abi, address } = getAbiAndAddress('TBTCConstants');
export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);

interface ICache {
  [key: string]: any;
}

// since this contract holds only constants, it's fine to cache the result
const cache: ICache = {};

export async function getMinBtcConfirmations(): Promise<number> {
  const cacheKey = 'minBtcConfirmations';
  cache[cacheKey] = cache[cacheKey] || (await contract.functions.getTxProofDifficultyFactor())[0].toNumber();

  return cache[cacheKey];
}

export async function getMinRedemptionFee(): Promise<number> {
  const cacheKey = 'minRedemptionFee';
  cache[cacheKey] = cache[cacheKey] || (await contract.functions.getMinimumRedemptionFee())[0].toNumber();

  return cache[cacheKey];
}
