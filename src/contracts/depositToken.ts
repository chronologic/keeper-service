import { ethers } from 'ethers';

import { ethClient } from '../clients';
import { IEthTx } from '../types';
import getAbiAndAddress from './getAbiAndAddress';
import { contract as fundingScriptContract } from './fundingScript';
import { contract as vendingMachineContract } from './vendingMachine';

const { abi, address } = getAbiAndAddress('TBTCDepositToken');

export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);

export async function approve(depositAddress: string): Promise<IEthTx> {
  return contract.functions.approve(vendingMachineContract.address, depositAddress);
}

export async function approveAndCall(depositAddress: string, callData: string): Promise<IEthTx> {
  return contract.functions.approveAndCall(fundingScriptContract.address, depositAddress, callData, {
    gasLimit: 1_000_000,
  });
}
