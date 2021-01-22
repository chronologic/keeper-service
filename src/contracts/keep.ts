import { BigNumber, ethers } from 'ethers';

import { ethClient } from '../clients';
import getAbiAndAddress from './getAbiAndAddress';
// for some reason there's no complete ABI for BondedECDSAKeep in @keep-network/tbtc
import keepAbi from '../abi/BondedECDSAKeep.json';

interface IKeepContract {
  getBondedEth(): Promise<BigNumber>;
  getOpenedTimestamp(): Promise<number>;
  getMembers(): Promise<string[]>;
  getSignatureSubmittedEvent(expectedDigest: string, fromBlock: number): Promise<ISignatureSubmittedEvent>;
  waitOnSignatureSubmittedEvent(expectedDigest: string, fromBlock: number): Promise<ISignatureSubmittedEvent>;
}

interface ISignatureSubmittedEvent {
  digest: string;
  r: string;
  s: string;
  recoveryID: number;
}

export default function getContractAt(address: string): IKeepContract {
  const contract = new ethers.Contract(address, keepAbi, ethClient.defaultWallet);

  return {
    getBondedEth,
    getMembers,
    getOpenedTimestamp,
    getSignatureSubmittedEvent,
    waitOnSignatureSubmittedEvent,
  };

  async function getBondedEth() {
    return contract.functions.checkBondAmount();
  }
  async function getOpenedTimestamp() {
    const [createdAtBn] = await contract.functions.getOpenedTimestamp();
    const createdAtTimestamp = createdAtBn.toNumber() * 1000;
    return createdAtTimestamp;
  }
  async function getMembers() {
    const [members] = await contract.functions.getMembers();
    return members.map((m: string) => m.toLowerCase());
  }
  async function getSignatureSubmittedEvent(expectedDigest: string, fromBlock: number) {
    const [event] = await contract.queryFilter(contract.filters.SignatureSubmitted(expectedDigest), fromBlock);

    const [digest, r, s, recoveryID] = event.args;

    return { digest, r, s, recoveryID };
  }
  async function waitOnSignatureSubmittedEvent(expectedDigest: string, fromBlock: number) {
    try {
      const event = await getSignatureSubmittedEvent(expectedDigest, fromBlock);
      return event;
    } catch (e) {
      return new Promise<ISignatureSubmittedEvent>((resolve, reject) => {
        contract.on(contract.filters.SignatureSubmitted(expectedDigest), () => {
          resolve(getSignatureSubmittedEvent(expectedDigest, fromBlock));
        });
      });
    }
  }
}
