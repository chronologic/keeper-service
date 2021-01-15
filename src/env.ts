import dotenv from 'dotenv';

dotenv.config();

export const TBTC_SYSTEM_ADDRESS = process.env.TBTC_SYSTEM_ADDRESS || '';
export const BONDED_ECDSA_KEEP_FACTORY_ADDRESS = process.env.BONDED_ECDSA_KEEP_FACTORY_ADDRESS || '';
export const INFURA_API_KEY = process.env.INFURA_API_KEY || '';
export const DEPOSIT_SYNC_MIN_BLOCK = Number(process.env.DEPOSIT_SYNC_MIN_BLOCK || 10880657);
export const COLLATERAL_CHECK_INTERVAL_MINUTES = Number(process.env.COLLATERAL_CHECK_INTERVAL_MINUTES || 5);
export const COLLATERAL_BUFFER_PERCENT = Number(process.env.COLLATERAL_BUFFER_PERCENT || 5);
export const MIN_LOT_SIZE_BTC = Number(process.env.MIN_LOT_SIZE_BTC || 1);
export const ELECTRUMX_HOST = process.env.ELECTRUMX_HOST || '';
export const ELECTRUMX_PORT = process.env.ELECTRUMX_PORT || '';
export const ELECTRUMX_PROTOCOL = process.env.ELECTRUMX_PROTOCOL || '';
export const ELECTRUMX_NETWORK = process.env.ELECTRUMX_NETWORK || '';
