import { ethers } from 'ethers';

import { ethClient } from '../clients';
import { ITx } from '../types';
import getAbiAndAddress from './getAbiAndAddress';

const { abi, address } = getAbiAndAddress('TBTCToken');
export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);

export async function approve(spender: string, amount: ethers.BigNumber): Promise<ITx> {
  return contract.functions.approve(spender, amount);
}
