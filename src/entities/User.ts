import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from "typeorm";
import { Payment } from "./Payment";
import { Operator } from "./Operator";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany((_type) => Payment, (payment) => payment.user, { nullable: true })
  payments: Payment[];

  @OneToMany((_type) => Operator, (operator) => operator.user, { nullable: true })
  operators: Operator[];

  @Index({ unique: true })
  @Column()
  addressEth: string;

  @Index({ unique: true })
  @Column()
  paymentAddressEth: string;

  // uint256 max length in base-10 is 78 characters
  @Column({ type: "numeric", precision: 78, scale: 0 })
  balanceEth: string;

  @Column()
  email: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
