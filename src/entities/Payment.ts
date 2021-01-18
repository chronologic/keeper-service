import { BigNumber } from 'ethers';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

import { bigNumberColumnOptions, lowercaseTransformer } from './shared';
import { User } from './User';

@Entity()
export class Payment {
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

  @Column()
  status: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
