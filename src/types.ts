import { BigNumber } from 'ethers';

export interface IDepositContract {
  getStatusCode(): Promise<number>;
  getKeepAddress(): Promise<string>;
  getLotSizeSatoshis(): Promise<BigNumber>;
  getSignerFeeTbtc(): Promise<BigNumber>;
  getCollateralizationPercent(): Promise<number>;
  getUndercollateralizedThresholdPercent(): Promise<number>;
  getRedemptionCost(): Promise<BigNumber>;
  getRedemptionFee(): Promise<BigNumber>;
  getUtxoValue(): Promise<number>;
  provideRedemptionSignature(v: string, r: string, s: string): Promise<IEthTx>;
  provideRedemptionProof(proof: IFundingProof): Promise<IEthTx>;
  retrieveSignerPubkey(): Promise<IEthTx>;
  provideBTCFundingProof(proof: IFundingProof): Promise<IEthTx>;
}

export interface IEthTx {
  nonce: number;
  gasPrice: BigNumber;
  gasLimit: BigNumber;
  to: string;
  value: BigNumber;
  data: string;
  chainId: number;
  v: number;
  r: string;
  s: string;
  from: string;
  hash: string;
  wait: [Function];
}

export interface ElectrumConfig {
  server: string;
  port: string;
  protocol: string;
  options?: any;
}

export interface IFundingProof {
  version: Buffer;
  inputVector: Buffer;
  outputVector: Buffer;
  locktime: Buffer;
  outputPosition: number;
  merkleProof: Buffer;
  indexInBlock: number;
  bitcoinHeaders: Buffer;
}

export interface IEthersTxOptions {
  gasPrice: number;
  gasLimit: number;
  nonce: number;
  value: BigNumber;
}
