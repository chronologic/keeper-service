import { ethers } from 'ethers';

import TBTCSystemABI from '../abi/TBTCSystem.json';
import { ethClient } from '../clients';
import { getTbtcSystemAddress } from './depositFactory';

// eslint-disable-next-line no-underscore-dangle
let _contract: ethers.Contract;

export async function getContract(): Promise<ethers.Contract> {
  _contract = _contract || new ethers.Contract(await getTbtcSystemAddress(), TBTCSystemABI, ethClient.getMainWallet());

  return _contract;
}
