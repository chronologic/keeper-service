import createGetter, { IEnvParams } from './getAbiAndAddress';

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

const getKeepAbiAndAddress = createGetter(envParams);

export default getKeepAbiAndAddress;
