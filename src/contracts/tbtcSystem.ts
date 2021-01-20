import { BigNumber, ethers } from 'ethers';

import TBTCSystemABI from '../abi/TBTCSystem.json';
import { ethClient } from '../clients';
import { getTbtcSystemAddress } from './depositFactory';

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

// eslint-disable-next-line no-underscore-dangle
let _contract: ethers.Contract;

export async function getContract(): Promise<ethers.Contract> {
  _contract = _contract || new ethers.Contract(await getTbtcSystemAddress(), TBTCSystemABI, ethClient.getMainWallet());

  return _contract;
}

export async function getRedemptionDetailsFromEvent(
  txHash: string,
  depositAddress: string,
  fromBlock: number
): Promise<IRedemptionDetails> {
  const contract = await getContract();
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
  const contract = await getContract();
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
    const contract = await getContract();
    return new Promise<IRegisteredPubKeyEvent>((resolve, reject) => {
      contract.on(contract.filters.SignatureSubmitted(depositAddress), () => {
        resolve(getRegisteredPubKeyEvent(depositAddress, fromBlock));
      });
    });
  }
}
