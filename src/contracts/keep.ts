import { BigNumber, ethers } from 'ethers';

import { ethClient } from '../clients';
// for some reason there's no complete ABI for BondedECDSAKeep in @keep-network/tbtc
import keepAbi from '../abi/BondedECDSAKeep.json';

interface IKeepContract {
  getBondedEth(): Promise<BigNumber>;
  getOpenedTimestamp(): Promise<number>;
  getMembers(): Promise<string[]>;
  getSignatureSubmittedEvent(expectedDigest: string, fromBlock: number): Promise<ISignatureSubmittedEvent>;
  getOrWaitForSignatureSubmittedEvent(expectedDigest: string, fromBlock: number): Promise<ISignatureSubmittedEvent>;
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
    getOrWaitForSignatureSubmittedEvent,
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
    const event = await getRawSignatureSubmittedEvent(expectedDigest, fromBlock);
    return parseSignatureSubmittedEvent(event);
  }
  async function getRawSignatureSubmittedEvent(expectedDigest: string, fromBlock: number): Promise<ethers.Event> {
    const [event] = await contract.queryFilter(contract.filters.SignatureSubmitted(expectedDigest), fromBlock);
    return event;
  }
  function parseSignatureSubmittedEvent(signatureSubmittedEvent: ethers.Event): ISignatureSubmittedEvent {
    const [digest, r, s, recoveryID] = signatureSubmittedEvent.args;
    return { digest, r, s, recoveryID };
  }
  async function getOrWaitForSignatureSubmittedEvent(expectedDigest: string, fromBlock: number) {
    const event = await getRawSignatureSubmittedEvent(expectedDigest, fromBlock);

    if (event) {
      return parseSignatureSubmittedEvent(event);
    }
    return new Promise<ISignatureSubmittedEvent>((resolve, reject) => {
      contract.on(contract.filters.SignatureSubmitted(expectedDigest), () => {
        resolve(getSignatureSubmittedEvent(expectedDigest, fromBlock));
      });
    });
  }
}
