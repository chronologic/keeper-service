import { BigNumber } from 'ethers';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';

import { bigNumberColumnOptions } from './shared';
import { User } from './User';
import { DepositTx } from './DepositTx';

@Entity()
export class UserDepositTxPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => User, { onDelete: 'SET NULL', nullable: true })
  user: User;

  @Column({ nullable: true })
  userId: number;

  @ManyToOne((_type) => DepositTx, { onDelete: 'SET NULL', nullable: true })
  depositTx: DepositTx;

  @Column({ nullable: true })
  depositTxId: number;

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
