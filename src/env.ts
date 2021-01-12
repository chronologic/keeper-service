import dotenv from 'dotenv';

dotenv.config();

export const TBTC_SYSTEM_ADDRESS = process.env.TBTC_SYSTEM_ADDRESS || '';
export const BONDED_ECDSA_KEEP_FACTORY_ADDRESS = process.env.BONDED_ECDSA_KEEP_FACTORY_ADDRESS || '';
