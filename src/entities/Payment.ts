import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';
import { bigNumberColumnOptions } from './constants';
import { User } from './User';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((_type) => User, { onDelete: 'CASCADE' })
  user: User;

  @Index({ unique: true })
  @Column()
  txHash: string;

  @Column(bigNumberColumnOptions)
  amount: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
