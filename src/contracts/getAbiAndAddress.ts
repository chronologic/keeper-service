/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
import { ETH_NETWORK } from '../env';

interface IAbiAndAddress {
  abi: any;
  address: string;
}

interface IEnvParams {
  [key: string]: {
    chainId: string;
    artifactsPath: string;
  };
}

const envParams: IEnvParams = Object.freeze({
  mainnet: {
    chainId: '1',
    artifactsPath: '@keep-network/tbtc/artifacts',
  },
  ropsten: {
    chainId: '3',
    artifactsPath: '@keep-network/tbtc-ropsten/artifacts',
  },
});

export default function getAbiAndAddress(filename: string): IAbiAndAddress {
  const { artifactsPath, chainId } = envParams[ETH_NETWORK];
  const artifact = require(`${artifactsPath}/${filename}.json`);

  return {
    abi: artifact.abi,
    address: artifact.networks[chainId]?.address,
  };
}
