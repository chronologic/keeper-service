import { BigNumber, ethers } from 'ethers';

import { ethClient } from '../clients';
import { IEthTx } from '../types';
import getAbiAndAddress from './getKeepAbiAndAddress';

const { abi, address } = getAbiAndAddress('TBTCToken');
export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);

export async function approve(spender: string, amount: ethers.BigNumber): Promise<IEthTx> {
  return contract.functions.approve(spender, amount);
}

export async function balanceOf(address: string): Promise<BigNumber> {
  const [balance] = await contract.functions.balanceOf(address);

  return balance;
}
