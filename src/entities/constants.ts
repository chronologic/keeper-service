import { ColumnOptions } from 'typeorm';

// uint256 max length in base-10 is 78 characters
export const bigNumberColumnOptions: ColumnOptions = { type: 'numeric', precision: 78, scale: 0 };
