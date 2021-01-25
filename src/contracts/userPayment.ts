import { ethers } from 'ethers';

import { ethClient } from '../clients';
import getAbiAndAddress from './getKeeperAbiAndAddress';

const { abi, address } = getAbiAndAddress('EthForwarder');

export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);
