import dotenv from 'dotenv';

dotenv.config();

export const TBTC_SYSTEM_ADDRESS = process.env.TBTC_SYSTEM_ADDRESS || '';
export const BONDED_ECDSA_KEEP_FACTORY_ADDRESS = process.env.BONDED_ECDSA_KEEP_FACTORY_ADDRESS || '';
export const RPC_URL = process.env.RPC_URL || '';
export const RPC_WS_URL = process.env.RPC_WS_URL || '';
export const INFURA_API_KEY = process.env.INFURA_API_KEY || '';
export const DEPOSIT_SYNC_MIN_BLOCK = process.env.DEPOSIT_SYNC_MIN_BLOCK || '';
