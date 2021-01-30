import { BigNumber } from 'ethers';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { bigNumberColumnOptions, lowercaseTransformer } from './shared';
import { Operator } from './Operator';
import { DepositTx } from './DepositTx';

// status codes from the Deposit contract
export enum Status {
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
}

enum SystemStatus {
  QUEUED_FOR_REDEMPTION = 'QUEUED_FOR_REDEMPTION',
  REDEEMING = 'REDEEMING',
  REDEEMED = 'REDEEMED',
  ERROR = 'ERROR',
}

@Entity()
export class Deposit {
  // TODO: improve this
  // lame definitions to achieve property access via Deposit.Status.REDEEMED
  // and type annotations via status: Deposit['Status'] (Deposit.Status would be better though)
  static Status = Status;

  Status: Status;

  static SystemStatus = SystemStatus;

  SystemStatus: SystemStatus;

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany((_type) => Operator, (operator) => operator.deposits)
  operators: Operator[];

  @OneToMany((_type) => DepositTx, (depositOperation) => depositOperation.deposit, { nullable: true })
  depositTxs: DepositTx[];

  @OneToOne((_type) => Deposit, (deposit) => deposit.mintedDeposit, { nullable: true })
  @JoinColumn()
  mintedDeposit: Deposit;

  @Column({ nullable: true })
  mintedDepositId: number;

  @Index({ unique: true })
  @Column({ transformer: lowercaseTransformer })
  depositAddress: string;

  @Index({ unique: true })
  @Column({ transformer: lowercaseTransformer })
  keepAddress: string;

  @Index()
  @Column({ type: 'int' })
  blockNumber: number;

  @Column(bigNumberColumnOptions)
  lotSizeSatoshis: BigNumber;

  @Column(bigNumberColumnOptions)
  bondedEth: BigNumber;

  @Column({ ...bigNumberColumnOptions, nullable: true })
  redemptionCostEthEquivalent: BigNumber;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  redemptionCostUsdEquivalent: number;

  @Column({ ...bigNumberColumnOptions, nullable: true })
  redemptionCostEthEquivalentWithFee: BigNumber;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  redemptionCostUsdEquivalentWithFee: number;

  @Column({ type: 'smallint' })
  undercollateralizedThresholdPercent: number;

  @Column({ length: 100, nullable: true })
  redemptionAddress: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  redemptionAddressIndex: number;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  status: Status;

  @Index()
  @Column({ type: 'smallint' })
  statusCode: number;

  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true })
  systemStatus: SystemStatus;

  @Column({ type: 'timestamp with time zone' })
  createdAt: Date;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
