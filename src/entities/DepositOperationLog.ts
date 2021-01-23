import { BigNumber } from 'ethers';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

import {
  BlockchainType,
  DepositOperationLogDirection,
  DepositOperationLogStatus,
  DepositOperationLogType,
} from '../types';
import { bigNumberColumnOptions, lowercaseTransformer } from './shared';
import { Deposit } from './Deposit';

@Entity()
export class DepositOperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => Deposit, { onDelete: 'CASCADE' })
  deposit: Deposit;

  @Column()
  depositId: number;

  @Column({ length: 10 })
  blockchainType: BlockchainType;

  @Index()
  @Column({ length: 50 })
  operationType: DepositOperationLogType;

  @Column({ length: 3 })
  direction: DepositOperationLogDirection;

  @Index()
  @Column({ length: 20 })
  status: DepositOperationLogStatus;

  @Column({ transformer: lowercaseTransformer, nullable: true })
  txHash: string;

  @Column({ ...bigNumberColumnOptions, nullable: true })
  txCostEthEquivalent: BigNumber;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  txCostUsdEquivalent: number;

  @Column({ nullable: true })
  message: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
