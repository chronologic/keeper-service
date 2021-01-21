import { ethers } from 'ethers';

import { ETH_NETWORK, ETH_XPRV, INFURA_API_KEY } from '../env';
import { SECOND_MILLIS } from '../constants';

export const wsProvider = new ethers.providers.InfuraWebSocketProvider(ETH_NETWORK, INFURA_API_KEY);
export const httpProvider = new ethers.providers.InfuraProvider(ETH_NETWORK, INFURA_API_KEY);
// lower polling interval to reduce resource usage
httpProvider.pollingInterval = 15 * SECOND_MILLIS;

const hdNode = ethers.utils.HDNode.fromExtendedKey(ETH_XPRV);
export const defaultWallet = new ethers.Wallet(getPrivKeyAtIndex(0), httpProvider);

export function getAddressAtIndex(index: number): string {
  return hdNode.derivePath(index.toString()).address.toLowerCase();
}

export function getPrivKeyAtIndex(index: number): string {
  return hdNode.derivePath(index.toString()).privateKey;
}
