import { ethers } from 'ethers';

import { ETH_NETWORK, ETH_XPRV, INFURA_API_KEY } from '../env';
import { ETH_MIN_CONFIRMATIONS, SECOND_MILLIS } from '../constants';

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

export async function confirmTransaction(txHash: string): Promise<ethers.providers.TransactionReceipt> {
  const txReceipt = await httpProvider.waitForTransaction(txHash, ETH_MIN_CONFIRMATIONS);
  if (txReceipt.status === 0) {
    throw new Error(`Transaction failed ${txHash} ${JSON.stringify(txReceipt)}`);
  }

  return txReceipt;
}
