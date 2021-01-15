import { ethers } from 'ethers';

import { BONDED_ECDSA_KEEP_FACTORY_ADDRESS, INFURA_API_KEY, TBTC_SYSTEM_ADDRESS } from '../env';
import tbtcSystemAbi from '../abi/TBTCSystem.json';
import bondedEcdsaKeepFactoryAbi from '../abi/BondedECDSAKeepFactory.json';
import bondedEcdsaKeepAbi from '../abi/BondedECDSAKeep.json';
import depositAbi from '../abi/Deposit.json';

const SIXTY_SECONDS_MS = 60 * 1000;

// const provider = ethers.getDefaultProvider();
const wsProvider = new ethers.providers.InfuraWebSocketProvider('mainnet', INFURA_API_KEY);
const httpProvider = new ethers.providers.InfuraProvider('mainnet', INFURA_API_KEY);
// lower polling interval to reduce resource usage
httpProvider.pollingInterval = SIXTY_SECONDS_MS;

export { wsProvider };
export { httpProvider };

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
