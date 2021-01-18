import { BigNumber, ethers } from 'ethers';

import KeepABI from '../abi/BondedECDSAKeep.json';
import { ethClient } from '../clients';

interface IKeepContract {
  getBondedEth(): Promise<BigNumber>;
  getOpenedTimestamp(): Promise<number>;
  getMembers(): Promise<string[]>;
}

export default function getContractAt(address: string): IKeepContract {
  const contract = new ethers.Contract(address, KeepABI, ethClient.getMainWallet());

  return {
    async getBondedEth() {
      return contract.functions.checkBondAmount();
    },
    async getOpenedTimestamp() {
      const [createdAtBn] = await contract.functions.getOpenedTimestamp();
      const createdAtTimestamp = createdAtBn.toNumber() * 1000;
      return createdAtTimestamp;
    },
    async getMembers() {
      const [members] = await contract.functions.getMembers();
      return members.map((m: string) => m.toLowerCase());
    },
  };
}
