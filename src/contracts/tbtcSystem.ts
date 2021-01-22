import { BigNumber, ethers } from 'ethers';

import { ethClient } from '../clients';
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

interface IRegisteredPubKeyEvent {
  _depositContractAddress: string;
  _signingGroupKeyX: any;
  _signingGroupKeyY: any;
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

export async function getRegisteredPubKeyEvent(
  depositAddress: string,
  fromBlock: number
): Promise<IRegisteredPubKeyEvent> {
  const [event] = await contract.queryFilter(contract.filters.RegisteredPubKey(depositAddress), fromBlock);

  const [_depositContractAddress, _signingGroupKeyX, _signingGroupKeyY] = event.args;

  return { _depositContractAddress, _signingGroupKeyX, _signingGroupKeyY };
}

export async function waitOnRegisteredPubKeyEvent(
  depositAddress: string,
  fromBlock: number
): Promise<IRegisteredPubKeyEvent> {
  try {
    const event = await getRegisteredPubKeyEvent(depositAddress, fromBlock);
    return event;
  } catch (e) {
    return new Promise<IRegisteredPubKeyEvent>((resolve, reject) => {
      contract.on(contract.filters.SignatureSubmitted(depositAddress), () => {
        resolve(getRegisteredPubKeyEvent(depositAddress, fromBlock));
      });
    });
  }
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
