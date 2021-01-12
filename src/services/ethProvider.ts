import { ethers } from 'ethers';

import { BONDED_ECDSA_KEEP_FACTORY_ADDRESS, TBTC_SYSTEM_ADDRESS } from '../env';
import tbtcSystemAbi from '../abi/TBTCSystem.json';
import bondedEcdsaKeepFactoryAbi from '../abi/BondedECDSAKeepFactory.json';
import bondedEcdsaKeepAbi from '../abi/BondedECDSAKeep.json';
import depositAbi from '../abi/Deposit.json';

const SIXTY_SECONDS_MS = 60 * 1000;

const provider = ethers.getDefaultProvider();
// lower polling interval to reduce resource usage
provider.pollingInterval = SIXTY_SECONDS_MS;

export default provider;

export const tbtcSystemContract = new ethers.Contract(TBTC_SYSTEM_ADDRESS, tbtcSystemAbi, provider);
export const bondedEcdsaKeepFactoryContract = new ethers.Contract(
  BONDED_ECDSA_KEEP_FACTORY_ADDRESS,
  bondedEcdsaKeepFactoryAbi,
  provider
);

export function bondedEcdsaKeepContractAt(address: string): ethers.Contract {
  return new ethers.Contract(address, bondedEcdsaKeepAbi, provider);
}

export function depositContractAt(address: string): ethers.Contract {
  return new ethers.Contract(address, depositAbi, provider);
}
