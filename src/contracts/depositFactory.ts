import { BigNumber, ethers } from 'ethers';

import { ethClient } from '../clients';
import { IEthTx } from '../types';
import getAbiAndAddress from './getKeepAbiAndAddress';

const { abi, address } = getAbiAndAddress('DepositFactory');

export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);

export async function createDeposit(lotSize: BigNumber, creationFee: BigNumber): Promise<IEthTx> {
  return contract.functions.createDeposit(lotSize, { value: creationFee, gasLimit: 4_000_000 });
}
