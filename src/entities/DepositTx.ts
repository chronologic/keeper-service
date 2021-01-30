import { BigNumber } from 'ethers';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

import { bigNumberColumnOptions, lowercaseTransformer } from './shared';
import { Deposit } from './Deposit';

enum Type {
  // redeeming
  REDEEM_APPROVE_TBTC = 'REDEEM_APPROVE_TBTC', // TODO: approve once?
  REDEEM_REDEMPTION_REQUEST = 'REDEEM_REDEMPTION_REQUEST', // tbtcToBtc
  REDEEM_PROVIDE_REDEMPTION_SIG = 'REDEEM_PROVIDE_REDEMPTION_SIG',
  REDEEM_BTC_RELEASE = 'REDEEM_BTC_RELEASE',
  // REDEEM_BTC_RECEPTION = 'REDEEM_BTC_RECEPTION', // TODO: remove
  REDEEM_PROVIDE_REDEMPTION_PROOF = 'REDEEM_PROVIDE_REDEMPTION_PROOF',

  // minting
  MINT_CREATE_DEPOSIT = 'MINT_CREATE_DEPOSIT',
  MINT_RETRIEVE_PUBKEY = 'MINT_RETRIEVE_PUBKEY',
  MINT_FUND_BTC = 'MINT_FUND_BTC',
  MINT_PROVIDE_FUNDING_PROOF = 'MINT_PROVIDE_FUNDING_PROOF',
  // MINT_APPROVE_AND_CALL_TDT = 'MINT_APPROVE_AND_CALL_TDT', // TODO: this may replace all the actions below
  MINT_APPROVE_TDT = 'MINT_APPROVE_TDT',
  MINT_TDT_TO_TBTC = 'MINT_TDT_TO_TBTC',
}

enum Status {
  BROADCASTED = 'BROADCASTED',
  CONFIRMED = 'CONFIRMED',
  ERROR = 'ERROR',
}

@Entity()
export class DepositTx {
  // TODO: improve this
  // lame definitions to achieve property access via DepositTx.Status.CONFIRMED
  // and type annotations via status: DepositTx['Status'] (DepositTx.Status would be better though)
  static Status = Status;

  Status: Status;

  static Type = Type;

  Type: Type;

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => Deposit, { onDelete: 'CASCADE' })
  deposit: Deposit;

  @Column()
  depositId: number;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  operationType: Type;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  status: Status;

  @Column({ transformer: lowercaseTransformer, nullable: true })
  txHash: string;

  @Column({ ...bigNumberColumnOptions, nullable: true })
  txCostEthEquivalent: BigNumber;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  txCostUsdEquivalent: number;

  @Column({ ...bigNumberColumnOptions, nullable: true })
  txCostEthEquivalentWithFee: BigNumber;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  txCostUsdEquivalentWithFee: number;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
