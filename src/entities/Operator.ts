import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  Index,
  JoinTable,
} from 'typeorm';
import { lowercaseTransformer } from './shared';
import { Deposit } from './Deposit';
import { User } from './User';

@Entity()
export class Operator {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany((_type) => User, (user) => user.operators)
  @JoinTable()
  users: User[];

  @ManyToMany((_type) => Deposit, (deposit) => deposit.operators)
  @JoinTable()
  deposits: Deposit[];

  @Index({ unique: true })
  @Column({ transformer: lowercaseTransformer })
  address: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
