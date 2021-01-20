import { ethers } from 'ethers';

import TBTCTokenABI from '../abi/TBTCToken.json';
import { ethClient } from '../clients';
import { ITx } from '../types';
import { getTbtcTokenAddress } from './depositFactory';

// eslint-disable-next-line no-underscore-dangle
let _contract: ethers.Contract;

export async function approve(spender: string, amount: ethers.BigNumber): Promise<ITx> {
  const contract = await getContract();

  return contract.functions.approve(spender, amount);
}

async function getContract(): Promise<ethers.Contract> {
  _contract = _contract || new ethers.Contract(await getTbtcTokenAddress(), TBTCTokenABI, ethClient.getMainWallet());

  return _contract;
}
