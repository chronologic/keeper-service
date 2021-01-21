import { ethers } from 'ethers';

import { ethClient } from '../clients';
import getAbiAndAddress from './getAbiAndAddress';

const { abi, address } = getAbiAndAddress('TBTCConstants');
export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);

interface ICache {
  [key: string]: any;
}

// since this contract holds only constants, it's fine to cache the result
const cache: ICache = {};

export async function getMinBtcConfirmations(): Promise<number> {
  const cacheKey = 'minBtcConfirmations';
  cache[cacheKey] = cache[cacheKey] || (await contract.functions.getTxProofDifficultyFactor())[0];

  return cache[cacheKey].toNumber();
}
