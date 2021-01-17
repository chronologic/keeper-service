import { ethers } from 'ethers';

import ERC20ABI from '../abi/ERC20.json';
import { ethClient } from '../services';
import { getTbtcTokenAddress } from './depositFactory';

// eslint-disable-next-line no-underscore-dangle
let _contract: ethers.Contract;

export async function approve(spender: string, amount: ethers.BigNumber): Promise<string> {
  const contract = await getContract();

  return contract.functions.approve(spender, amount);
}

async function getContract(): Promise<ethers.Contract> {
  _contract = _contract || new ethers.Contract(await getTbtcTokenAddress(), ERC20ABI as any, ethClient.getMainWallet());

  return _contract;
}
