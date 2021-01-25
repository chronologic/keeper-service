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
import { DepositOperationLog } from './DepositOperationLog';

@Entity()
export class Deposit {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany((_type) => Operator, (operator) => operator.deposits)
  operators: Operator[];

  @OneToMany((_type) => DepositOperationLog, (depositOperation) => depositOperation.deposit, { nullable: true })
  depositOperations: DepositOperationLog[];

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

  @Column({ type: 'smallint' })
  undercollateralizedThresholdPercent: number;

  @Column({ length: 100, nullable: true })
  redemptionAddress: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  redemptionAddressIndex: number;

  @Index()
  @Column({ length: 40 })
  status: string;

  @Index()
  @Column({ type: 'smallint' })
  statusCode: number;

  @Index()
  @Column({ length: 40, nullable: true })
  systemStatus: string;

  @Column({ type: 'timestamp with time zone' })
  createdAt: Date;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
