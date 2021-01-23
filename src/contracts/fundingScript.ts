import { ethers } from 'ethers';

import { ethClient } from '../clients';
import getAbiAndAddress from './getAbiAndAddress';

const { abi, address } = getAbiAndAddress('FundingScript');

export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);
