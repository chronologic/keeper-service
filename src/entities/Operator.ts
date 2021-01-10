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
} from "typeorm";
import { Deposit } from "./Deposit";
import { User } from "./User";

@Entity()
export class Operator {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => User, { onDelete: "CASCADE" })
  user: User;

  @ManyToMany((_type) => Operator, (operator) => operator.deposits)
  @JoinTable()
  deposits: Deposit[];

  @Index({ unique: true })
  @Column()
  address: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
