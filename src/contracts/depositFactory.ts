import { ethers } from 'ethers';

import DepositFactoryABI from '../abi/DepositFactory.json';
import { DEPOSIT_FACTORY_ADDRESS } from '../env';
import { ethClient } from '../clients';

const contract = new ethers.Contract(DEPOSIT_FACTORY_ADDRESS, DepositFactoryABI, ethClient.httpProvider);

const values: {
  [key: string]: string;
} = {};

export async function getTbtcSystemAddress(): Promise<string> {
  return getValueForKey('tbtcSystem');
}

export async function getTbtcTokenAddress(): Promise<string> {
  return getValueForKey('tbtcToken');
}

export async function getVendingMachineAddress(): Promise<string> {
  return getValueForKey('vendingMachineAddress');
}

async function getValueForKey(key: string): Promise<any> {
  values[key] = values[key] || (await contract.functions[key]())[0];
  return values[key];
}
