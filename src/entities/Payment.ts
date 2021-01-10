import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from "typeorm";
import { User } from "./User";

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => User, { onDelete: "CASCADE" })
  user: User;

  @Index({ unique: true })
  @Column()
  txHash: string;

  // uint256 max length in base-10 is 78 characters
  @Column({ type: "numeric", precision: 78, scale: 0 })
  amount: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
