import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToMany } from "typeorm";
import { Operator } from "./Operator";

@Entity()
export class Deposit {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany((_type) => Operator, (operator) => operator.deposits)
  operators: Operator[];

  @Index({ unique: true })
  @Column()
  contractAddress: string;

  // uint256 max length in base-10 is 78 characters
  @Column({ type: "numeric", precision: 78, scale: 0 })
  lotSize: string;

  // uint256 max length in base-10 is 78 characters
  @Column({ type: "numeric", precision: 78, scale: 0 })
  redemptionCostEth: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
