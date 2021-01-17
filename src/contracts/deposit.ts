import { ethers } from 'ethers';

import DepositABI from '../abi/Deposit.json';
import { ethClient } from '../services';

// TODO: call getRedemptionTbtcRequirement if 'inVendingMachine' (see tbtc.js)
export async function getOwnerRedemptionTbtcRequirementAt(address: string): Promise<ethers.BigNumber> {
  const contract = await getContractAt(address);
  const [fee] = await contract.functions.getOwnerRedemptionTbtcRequirement(ethClient.getMainAddress());

  return fee;
}

export async function getSignerFeeTbtcAt(address: string): Promise<ethers.BigNumber> {
  const contract = await getContractAt(address);
  const [fee] = await contract.functions.signerFeeTbtc();

  return fee;
}

async function getContractAt(address: string): Promise<ethers.Contract> {
  return new ethers.Contract(address, DepositABI, ethClient.getMainWallet());
}
