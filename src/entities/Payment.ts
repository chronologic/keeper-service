import { BigNumber } from 'ethers';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

import { bigNumberColumnOptions, lowercaseTransformer } from './shared';
import { User } from './User';

@Entity()
export class Payment {
  static Status = Object.freeze({
    CONFIRMED: 'CONFIRMED',
    ERROR: 'ERROR',
  });

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ nullable: true })
  userId: number;

  @Index({ unique: true })
  @Column({ transformer: lowercaseTransformer })
  txHash: string;

  @Column(bigNumberColumnOptions)
  amount: BigNumber;

  @Column({ length: 10 })
  status: string;

  @Index()
  @Column({ type: 'int' })
  blockNumber: number;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
