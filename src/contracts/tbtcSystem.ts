import { BigNumber, ethers } from 'ethers';

import { ethClient } from '../clients';
import { IFundingProof } from '../types';
import getAbiAndAddress from './getAbiAndAddress';

interface IRedemptionDetails {
  depositContractAddress: string;
  requester: string;
  digest: string;
  utxoValue: BigNumber;
  redeemerOutputScript: string;
  requestedFee: BigNumber;
  outpoint: string;
}

interface IRegisteredPubkeyEvent {
  depositAddress: string;
  x: string;
  y: string;
}

const { abi, address } = getAbiAndAddress('TBTCSystem');

export const contract = new ethers.Contract(address, abi, ethClient.defaultWallet);
const contractInterface = new ethers.utils.Interface(abi);

export async function getRedemptionDetailsFromEvent(
  txHash: string,
  depositAddress: string,
  fromBlock: number
): Promise<IRedemptionDetails> {
  const [event] = await contract.queryFilter(contract.filters.RedemptionRequested(depositAddress), fromBlock);
  if (event.transactionHash !== txHash) {
    throw new Error(
      `RedemptionRequest event does not match txhash ${txHash} for ${depositAddress} from block ${fromBlock}`
    );
  }

  const [
    depositContractAddress,
    requester,
    digest,
    utxoValue,
    redeemerOutputScript,
    requestedFee,
    outpoint,
  ] = event.args;

  return {
    depositContractAddress,
    requester,
    digest,
    utxoValue,
    redeemerOutputScript,
    requestedFee,
    outpoint,
  };
}

export async function getOrWaitForRegisteredPubkeyEvent(depositAddress: string, fromBlock: number) {
  const event = await getRawRegisteredPubkeyEvent(depositAddress, fromBlock);

  if (event) {
    return parseRegisteredPubkeyEvent(event);
  }
  return new Promise<IRegisteredPubkeyEvent>((resolve, reject) => {
    contract.on(contract.filters.RegisteredPubkey(depositAddress), () => {
      resolve(getRegisteredPubkeyEvent(depositAddress, fromBlock));
    });
  });
}
async function getRegisteredPubkeyEvent(depositAddress: string, fromBlock: number) {
  const event = await getRawRegisteredPubkeyEvent(depositAddress, fromBlock);
  return parseRegisteredPubkeyEvent(event);
}
async function getRawRegisteredPubkeyEvent(depositAddress: string, fromBlock: number): Promise<ethers.Event> {
  const [event] = await contract.queryFilter(contract.filters.RegisteredPubkey(depositAddress), fromBlock);
  return event;
}
function parseRegisteredPubkeyEvent(event: ethers.Event): IRegisteredPubkeyEvent {
  const [depositAddress, x, y] = event.args;
  return { depositAddress, x, y };
}

export async function getNewDepositFeeEstimate(): Promise<BigNumber> {
  const [estimate] = await contract.functions.getNewDepositFeeEstimate();

  return estimate;
}

export function parseLogs(logs: ethers.providers.Log[]): ethers.utils.LogDescription[] {
  return logs
    .map((l) => {
      try {
        return contractInterface.parseLog(l);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

export function findLog(logs: ethers.providers.Log[], logName: string): ethers.utils.LogDescription {
  return parseLogs(logs).find((l) => l.name === logName);
}
