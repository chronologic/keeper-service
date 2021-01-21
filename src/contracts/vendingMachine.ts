import { ethers } from 'ethers';

import { ethClient } from '../clients';
import { ITx } from '../types';
import getAbiAndAddress from './getAbiAndAddress';
import { approve } from './tbtcToken';

const { abi, address } = getAbiAndAddress('VendingMachine');

export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);

export async function approveSpendingTbtc(amount: ethers.BigNumber): Promise<ITx> {
  return approve(address, amount);
}

export async function tbtcToBtc(
  depositAddress: string,
  outputValueBytes: Buffer,
  redeemerOutputScript: string
): Promise<ITx> {
  return contract.functions.tbtcToBtc(depositAddress, outputValueBytes, redeemerOutputScript, { gasLimit: 1_000_000 });
}
