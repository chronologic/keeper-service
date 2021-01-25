import { ethers } from 'ethers';

import { ethClient } from '../clients';
import { IEthTx, IFundingProof } from '../types';
import getAbiAndAddress from './getKeepAbiAndAddress';
import { approve } from './tbtcToken';

const { abi, address } = getAbiAndAddress('VendingMachine');

export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);
const contractInterface = new ethers.utils.Interface(abi);

export async function approveSpendingTbtc(amount: ethers.BigNumber): Promise<IEthTx> {
  return approve(address, amount);
}

export async function tbtcToBtc(
  depositAddress: string,
  outputValueBytes: Buffer,
  redeemerOutputScript: string
): Promise<IEthTx> {
  return contract.functions.tbtcToBtc(depositAddress, outputValueBytes, redeemerOutputScript, { gasLimit: 1_000_000 });
}

export async function tdtToTbtc(depositAddress: string): Promise<IEthTx> {
  return contract.functions.tdtToTbtc(depositAddress, { gasLimit: 500_000 });
}

export function getEncodedAbiUnqualifiedDepositToTbtc(depositAddress: string, proofArgs: IFundingProof): string {
  const {
    version,
    inputVector,
    outputVector,
    locktime,
    outputPosition,
    merkleProof,
    indexInBlock,
    bitcoinHeaders,
  } = proofArgs;
  return contractInterface.encodeFunctionData('unqualifiedDepositToTbtc', [
    depositAddress,
    version,
    inputVector,
    outputVector,
    locktime,
    outputPosition,
    merkleProof,
    indexInBlock,
    bitcoinHeaders,
  ]);
}
