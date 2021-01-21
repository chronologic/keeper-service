import { BigNumber } from 'ethers';

// status codes from the Deposit contract
export enum DepositStatus {
  START,

  // FUNDING FLOW
  AWAITING_SIGNER_SETUP,
  AWAITING_BTC_FUNDING_PROOF,

  // FAILED SETUP
  FAILED_SETUP,

  // ACTIVE
  ACTIVE, // includes courtesy call

  // REDEMPTION FLOW
  AWAITING_WITHDRAWAL_SIGNATURE,
  AWAITING_WITHDRAWAL_PROOF,
  REDEEMED,

  // SIGNER LIQUIDATION FLOW
  COURTESY_CALL,
  FRAUD_LIQUIDATION_IN_PROGRESS,
  LIQUIDATION_IN_PROGRESS,
  LIQUIDATED,

  // KEEPER-SPECIFIC (NON-STANDARD STATUS CODES)
  KEEPER_QUEUED_FOR_REDEMPTION,
  KEEPER_REDEEMING,
  KEEPER_REDEEMED,
  KEEPER_REDEEM_ERROR,
}

export enum DepositOperationLogType {
  // redeeming
  REDEEM_APPROVE_TBTC = 'REDEEM_APPROVE_TBTC', // TODO: approve once?
  REDEEM_REDEMPTION_REQUEST = 'REDEEM_REDEMPTION_REQUEST', // tbtcToBtc
  REDEEM_PROVIDE_REDEMPTION_SIG = 'REDEEM_PROVIDE_REDEMPTION_SIG',
  REDEEM_BTC_RECEPTION = 'REDEEM_BTC_RECEPTION',
  REDEEM_PROVIDE_REDEMPTION_PROOF = 'REDEEM_PROVIDE_REDEMPTION_PROOF',

  // minting
  MINT_START = 'MINT_START',
  MINT_CREATE_DEPOSIT = 'MINT_CREATE_DEPOSIT',
  MINT_RETRIEVE_PUBKEY = 'MINT_RETRIEVE_PUBKEY',
  MINT_FUND_BTC = 'MINT_FUND_BTC',
  MINT_PROVIDE_FUNDING_PROOF = 'MINT_PROVIDE_FUNDING_PROOF',
  MINT_APPROVE_TDT = 'MINT_APPROVE_TDT', // TODO: approve once?
  MINT_TDT_TO_TBTC = 'MINT_TDT_TO_TBTC',
  MINT_TBTC_RECEPTION = 'MINT_TBTC_RECEPTION',
}

export enum DepositOperationLogDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum DepositOperationLogStatus {
  BROADCASTED = 'BROADCASTED',
  CONFIRMED = 'CONFIRMED',
  ERROR = 'ERROR',
}

export enum BlockchainType {
  ETHEREUM = 'ETHEREUM',
  BITCOIN = 'BITCOIN',
}

export interface IDepositContract {
  getStatusCode(): Promise<number>;
  getKeepAddress(): Promise<string>;
  getLotSizeSatoshis(): Promise<BigNumber>;
  getCollateralizationPercent(): Promise<number>;
  getUndercollateralizedThresholdPercent(): Promise<number>;
  getRedemptionCost(): Promise<BigNumber>;
  getRedemptionFee(): Promise<BigNumber>;
  getUtxoValue(): Promise<number>;
  provideRedemptionSignature(v: string, r: string, s: string): Promise<IEthTx>;
  provideRedemptionProof(proof: IFundingProof): Promise<IEthTx>;
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
