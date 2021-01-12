import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToMany } from 'typeorm';
import { bigNumberColumnOptions } from './constants';
import { Operator } from './Operator';

@Entity()
export class Deposit {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany((_type) => Operator, (operator) => operator.deposits)
  operators: Operator[];

  @Index({ unique: true })
  @Column()
  contractAddress: string;

  @Index()
  @Column({ type: 'int' })
  onChainId: number;

  @Column(bigNumberColumnOptions)
  lotSize: string;

  @Column(bigNumberColumnOptions)
  bondedEth: string;

  @Column(bigNumberColumnOptions)
  redemptionCostEth: string;

  @Column({ type: 'smallint' })
  undercollateralizedThresholdPercent: number;

  @Column()
  status: string;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
