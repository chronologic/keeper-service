import { BigNumber } from 'ethers';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

import { bigNumberColumnOptions, lowercaseTransformer } from './shared';
import { User } from './User';

enum Status {
  CONFIRMED = 'CONFIRMED',
  ERROR = 'ERROR',
}

@Entity()
export class Payment {
  // TODO: improve this
  // lame definitions to achieve property access via Payment.Status.CONFIRMED
  // and type annotations via status: Payment['Status'] (Payment.Status would be better though)
  Status: Status;

  static Status = Status;

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
