import { ethers } from 'ethers';

import { BONDED_ECDSA_KEEP_FACTORY_ADDRESS, ETH_NETWORK, ETH_XPRV, INFURA_API_KEY, TBTC_SYSTEM_ADDRESS } from '../env';
import tbtcSystemAbi from '../abi/TBTCSystem.json';
import bondedEcdsaKeepFactoryAbi from '../abi/BondedECDSAKeepFactory.json';
import bondedEcdsaKeepAbi from '../abi/BondedECDSAKeep.json';
import depositAbi from '../abi/Deposit.json';

const SIXTY_SECONDS_MS = 60 * 1000;

const wsProvider = new ethers.providers.InfuraWebSocketProvider(ETH_NETWORK, INFURA_API_KEY);
const httpProvider = new ethers.providers.InfuraProvider(ETH_NETWORK, INFURA_API_KEY);
// lower polling interval to reduce resource usage
httpProvider.pollingInterval = SIXTY_SECONDS_MS;

const hdNode = ethers.utils.HDNode.fromExtendedKey(ETH_XPRV);
const wallet = new ethers.Wallet(getMainPrivKey(), httpProvider);

export { wsProvider };
export { httpProvider };

export function getMainWallet(): ethers.Wallet {
  return wallet;
}

export function getMainAddress(): string {
  return getAddressAtIndex(0);
}

export function getMainPrivKey(): string {
  return getPrivKeyAtIndex(0);
}

export function getAddressAtIndex(index: number): string {
  return hdNode.derivePath(index.toString()).address.toLowerCase();
}

export function getPrivKeyAtIndex(index: number): string {
  return hdNode.derivePath(index.toString()).privateKey;
}

export const tbtcSystemContract = new ethers.Contract(TBTC_SYSTEM_ADDRESS, tbtcSystemAbi, httpProvider);
export const bondedEcdsaKeepFactoryContract = new ethers.Contract(
  BONDED_ECDSA_KEEP_FACTORY_ADDRESS,
  bondedEcdsaKeepFactoryAbi,
  httpProvider
);

export function bondedEcdsaKeepContractAt(address: string): ethers.Contract {
  return new ethers.Contract(address, bondedEcdsaKeepAbi, httpProvider);
}

export function depositContractAt(address: string): ethers.Contract {
  return new ethers.Contract(address, depositAbi, httpProvider);
}
