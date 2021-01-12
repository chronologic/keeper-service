import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { BigNumber } from 'ethers';

import { Payment } from './Payment';
import { Operator } from './Operator';
import { bigNumberColumnOptions, lowercaseTransformer } from './shared';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany((_type) => Payment, (payment) => payment.user, { nullable: true })
  payments: Payment[];

  @OneToMany((_type) => Operator, (operator) => operator.user, { nullable: true })
  operators: Operator[];

  @Index({ unique: true })
  @Column({ transformer: lowercaseTransformer })
  paymentAddressEth: string;

  @Column(bigNumberColumnOptions)
  balanceEth: BigNumber;

  @Column({ transformer: lowercaseTransformer })
  email: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
