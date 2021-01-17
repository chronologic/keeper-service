import { ethers } from 'ethers';

import VendingMachineABI from '../abi/VendingMachine.json';
import { ethClient } from '../services';
import { getVendingMachineAddress } from './depositFactory';
import { approve } from './tbtcToken';

// eslint-disable-next-line no-underscore-dangle
let _contract: ethers.Contract;

export async function approveSpendingTbtc(amount: ethers.BigNumber): Promise<string> {
  return approve(await getVendingMachineAddress(), amount);
}

export async function tbtcToBtc(
  depositAddress: string,
  outputValueBytes: any,
  redeemerOutputScript: any
): Promise<string> {
  const contract = await getContract();

  return contract.functions.tbtcToBtc(depositAddress, outputValueBytes, redeemerOutputScript);
}

async function getContract(): Promise<ethers.Contract> {
  _contract =
    _contract || new ethers.Contract(await getVendingMachineAddress(), VendingMachineABI, ethClient.getMainWallet());

  return _contract;
}
