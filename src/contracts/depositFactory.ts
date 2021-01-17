import { ethers } from 'ethers';

import DepositFactoryABI from '../abi/DepositFactory.json';
import { DEPOSIT_FACTORY_ADDRESS } from '../env';
import { ethClient } from '../services';

const contract = new ethers.Contract(DEPOSIT_FACTORY_ADDRESS, DepositFactoryABI, ethClient.httpProvider);

const addresses: {
  [key: string]: string;
} = {};

export async function getTbtcSystemAddress(): Promise<string> {
  const key = 'tbtcSystem';
  addresses[key] = addresses[key] || (await contract.functions[key]());

  return addresses[key];
}

export async function getTbtcTokenAddress(): Promise<string> {
  const key = 'tbtcToken';
  addresses[key] = addresses[key] || (await contract.functions[key]());

  return addresses[key];
}

export async function getVendingMachineAddress(): Promise<string> {
  const key = 'vendingMachineAddress';
  addresses[key] = addresses[key] || (await contract.functions[key]());

  return addresses[key];
}
