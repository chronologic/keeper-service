/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
import { ETH_NETWORK } from '../env';

interface IAbiAndAddress {
  abi: any;
  address: string;
}

export interface IEnvParams {
  [key: string]: {
    chainId: string;
    artifactsPath: string;
  };
}

type AbiAndAddressGetter = (filename: string) => IAbiAndAddress;

export default function createGetAbiAndAddress(config: IEnvParams): AbiAndAddressGetter {
  return (filename) => {
    const { artifactsPath, chainId } = config[ETH_NETWORK];
    const artifact = require(`${artifactsPath}/${filename}.json`);

    return {
      abi: artifact.abi,
      address: artifact.networks[chainId]?.address,
    };
  };
}
