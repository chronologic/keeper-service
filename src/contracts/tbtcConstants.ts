import { ethers } from 'ethers';

import { ethClient } from '../clients';
import getAbiAndAddress from './getAbiAndAddress';

const { abi, address } = getAbiAndAddress('TBTCConstants');
export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);

export async function getMinBtcConfirmations(): Promise<number> {
  return contract.functions.getTxProofDifficultyFactor();
}
