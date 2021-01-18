import { BigNumber } from 'ethers';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

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

  @Index()
  @Column({ length: 50 })
  operationType: string;

  @Column({ length: 10 })
  blockchainType: string;

  @Column({ length: 100, transformer: lowercaseTransformer, nullable: true })
  fromAddress: string;

  @Column({ length: 100, transformer: lowercaseTransformer, nullable: true })
  toAddress: string;

  @Column({ transformer: lowercaseTransformer })
  txHash: string;

  @Column({ ...bigNumberColumnOptions, nullable: true })
  txCostEthEquivalent: BigNumber;

  @Column({ type: 'money', nullable: true })
  txCostUsdEquivalent: number;

  @Column({ nullable: true })
  message: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
