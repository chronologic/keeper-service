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
  address: string;

  @Index({ unique: true })
  @Column({ transformer: lowercaseTransformer, nullable: true })
  paymentAddressEth: string;

  @Column({ ...bigNumberColumnOptions, nullable: true })
  balanceEth: BigNumber;

  @Column({ transformer: lowercaseTransformer, nullable: true })
  email: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
