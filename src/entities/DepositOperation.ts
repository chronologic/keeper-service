import { BigNumber } from 'ethers';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

import { bigNumberColumnOptions, lowercaseTransformer } from './shared';
import { Deposit } from './Deposit';

@Entity()
export class DepositOperation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => Deposit, { onDelete: 'CASCADE' })
  deposit: Deposit;

  @Index()
  @Column({ length: 50 })
  operationType: string;

  @Column({ length: 10 })
  blockchainType: string;

  @Column({ length: 100, transformer: lowercaseTransformer })
  fromAddress: string;

  @Column({ length: 100, transformer: lowercaseTransformer })
  toAddress: string;

  @Index({ unique: true })
  @Column({ transformer: lowercaseTransformer })
  txHash: string;

  @Column({ ...bigNumberColumnOptions, nullable: true })
  txCostEthEquivalent: BigNumber;

  @Column({ type: 'money', nullable: true })
  txCostUsdEquivalent: number;

  @Column({ type: 'boolean', default: false })
  confirmed: boolean;

  @Index()
  @Column({ length: 40 })
  status: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
