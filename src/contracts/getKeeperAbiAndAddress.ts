import createGetter, { IEnvParams } from './getAbiAndAddress';

const envParams: IEnvParams = Object.freeze({
  mainnet: {
    chainId: '1',
    artifactsPath: 'keeper-payment-contract/artifacts/',
  },
  ropsten: {
    chainId: '3',
    artifactsPath: 'keeper-payment-contract/artifacts/',
  },
});

const getKeeperAbiAndAddress = createGetter(envParams);

export default getKeeperAbiAndAddress;
