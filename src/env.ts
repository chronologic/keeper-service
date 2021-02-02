import dotenv from 'dotenv';

dotenv.config();

export const LOG_LEVEL = process.env.LOG_LEVEL as string;

export const ETH_NETWORK = process.env.ETH_NETWORK as string;
export const INFURA_API_KEY = process.env.INFURA_API_KEY as string;
export const ETH_XPRV = process.env.ETH_XPRV as string;

export const ELECTRUMX_NETWORK = process.env.ELECTRUMX_NETWORK as string;
export const ELECTRUMX_HOST = process.env.ELECTRUMX_HOST as string;
export const ELECTRUMX_PORT = process.env.ELECTRUMX_PORT as string;
export const ELECTRUMX_PROTOCOL = process.env.ELECTRUMX_PROTOCOL as string;
export const BTC_ZPRV = process.env.BTC_ZPRV as string;

export const MAILJET_API_KEY = process.env.MAILJET_API_KEY as string;
export const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET as string;
export const ADMIN_EMAIL_RECIPIENTS = (process.env.ADMIN_EMAIL_RECIPIENTS as string).split(',');
export const EMAIL_SENDER = process.env.EMAIL_SENDER as string;

export const MIN_USER_BALANCE_ETH = Number(process.env.MIN_USER_BALANCE_ETH || 0);
export const WARNING_USER_BALANCE_ETH = Number(process.env.WARNING_USER_BALANCE_ETH || 0);
export const USER_TX_FEE_PERCENT = Number(process.env.USER_TX_FEE_PERCENT || 0);

export const SYNC_MIN_BLOCK = Number(process.env.SYNC_MIN_BLOCK || 10880657);
export const COLLATERAL_CHECK_INTERVAL_MINUTES = Number(process.env.COLLATERAL_CHECK_INTERVAL_MINUTES || 5);
export const COLLATERAL_BUFFER_PERCENT = Number(process.env.COLLATERAL_BUFFER_PERCENT || 5);
export const MIN_LOT_SIZE_BTC = Number(process.env.MIN_LOT_SIZE_BTC || 1);
export const MAX_LOT_SIZE_BTC = Number(process.env.MAX_LOT_SIZE_BTC || 1000);
export const MIN_SYSTEM_TBTC_BALANCE = Number(process.env.MIN_SYSTEM_TBTC_BALANCE || 0);
export const MIN_SYSTEM_BTC_BALANCE = Number(process.env.MIN_SYSTEM_BTC_BALANCE || 0);
export const MIN_SYSTEM_ETH_BALANCE = Number(process.env.MIN_SYSTEM_ETH_BALANCE || 0);
