import { BigNumber, ethers } from 'ethers';

import { ETH_NETWORK, ETH_XPRV, INFURA_API_KEY } from '../env';
import { ETH_MIN_CONFIRMATIONS, SECOND_MILLIS } from '../constants';

const TX_STATUS_FAILED = 0;

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

export async function confirmTransaction(
  txHash: string
): Promise<{ receipt: ethers.providers.TransactionReceipt; success: boolean }> {
  const receipt = await httpProvider.waitForTransaction(txHash, ETH_MIN_CONFIRMATIONS);
  const success = isTransactionSuccessful(receipt);

  return {
    receipt,
    success,
  };
}

export function isTransactionSuccessful(txReceipt: ethers.providers.TransactionReceipt): boolean {
  return txReceipt.status !== TX_STATUS_FAILED;
}

export function bytesToRaw(bytesString: string): string {
  return bytesString.replace('0x', '').slice(2);
}

export async function getEthBalance(address: string): Promise<BigNumber> {
  return httpProvider.getBalance(address);
}
