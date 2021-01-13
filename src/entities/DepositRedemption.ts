import { BigNumber } from 'ethers';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  ManyToOne,
} from 'typeorm';

import { bigNumberColumnOptions, lowercaseTransformer } from './shared';
import { Operator } from './Operator';
import { Deposit } from './Deposit';

@Entity()
export class DepositRedemption {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => Deposit, { nullable: true, onDelete: 'CASCADE' })
  user: Deposit;

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
  redemptionCostEth: BigNumber;

  @Column({ type: 'smallint' })
  undercollateralizedThresholdPercent: number;

  @Index()
  @Column({ length: 40 })
  status: string;

  @Index()
  @Column({ type: 'smallint' })
  statusCode: number;

  @Column({ type: 'timestamp with time zone' })
  createdAt: Date;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
