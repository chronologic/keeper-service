import mailjet from 'node-mailjet';
import { Deposit, User } from 'keeper-db';

import { ADMIN_EMAIL_RECIPIENTS, EMAIL_SENDER, MAILJET_API_KEY, MAILJET_API_SECRET } from '../env';
import { bnToNumberBtc, bnToNumberEth, createTimedCache } from '../utils';
import { HOUR_MILLIS, MINUTE_MILLIS } from '../constants';
import { createLogger } from '../logger';
import userHelper from './userHelper';
import { BigNumber } from 'ethers';

const cache = createTimedCache<boolean>(60 * MINUTE_MILLIS);
const postSender = mailjet.connect(MAILJET_API_KEY, MAILJET_API_SECRET).post('send', { version: 'v3.1' });
const logger = createLogger('emailService');

type EmailParamsGetter = () => Promise<{ recipients: string[]; subject: string; body: string }>;

async function redemptionStart(deposit: Deposit): Promise<void> {
  const cacheKey = `REDEMPTION_START:${deposit.depositAddress}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const lotSizeBtc = bnToNumberBtc(deposit.lotSizeSatoshis);
    const subject = `🚀 Redemption started - ${lotSizeBtc} BTC ${deposit.depositAddress}`;
    const protectedUsers = await userHelper.getProtectedUsersForDeposit(deposit.id);
    const recipients = protectedUsers.map((u) => u.email).filter(Boolean);
    const body = `Redemption of deposit ${deposit.depositAddress} (${lotSizeBtc} BTC) has started due to being close to liquidation courtesy call.
You will receive another notification upon successful redemption.`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function redemptionComplete(deposit: Deposit): Promise<void> {
  const cacheKey = `REDEMPTION_COMPLETE:${deposit.depositAddress}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const lotSizeBtc = bnToNumberBtc(deposit.lotSizeSatoshis);
    const subject = `✅ Redemption complete - ${lotSizeBtc} BTC ${deposit.depositAddress}`;
    const protectedUsers = await userHelper.getProtectedUsersForDeposit(deposit.id);
    const recipients = protectedUsers.map((u) => u.email).filter(Boolean);
    const body = `Redemption of deposit ${deposit.depositAddress} (${lotSizeBtc} BTC) completed successfully.`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function redemptionError(deposit: Deposit): Promise<void> {
  const cacheKey = `REDEMPTION_ERROR:${deposit.depositAddress}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const lotSizeBtc = bnToNumberBtc(deposit.lotSizeSatoshis);
    const subject = `❌ Redemption ERROR - ${lotSizeBtc} BTC ${deposit.depositAddress}`;
    const protectedUsers = await userHelper.getProtectedUsersForDeposit(deposit.id);
    const recipients = protectedUsers.map((u) => u.email).filter(Boolean);
    const body = `Redemption of deposit ${deposit.depositAddress} (${lotSizeBtc} BTC) failed due to an error.`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function accountBalanceLow(user: User): Promise<void> {
  const cacheKey = `ACCOUNT_BALANCE_LOW:${user.id}`;
  const cacheTtl = 6 * HOUR_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const formattedBalance = bnToNumberEth(user.balanceEth);
    const subject = `💸 Account balance low - ${formattedBalance} ETH at ${user.address}`;
    const recipients = [user.email];
    const body = `Your account ${user.address} balance is running low and is currently ${formattedBalance} ETH.
Please top it up to ensure protection of your Operator Node's deposits.`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function accountToppedUp(
  user: User,
  address: string,
  txHash: string,
  amount: BigNumber,
  balance: BigNumber
): Promise<void> {
  const cacheKey = `ACCOUNT_TOP_UP:${txHash}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const formattedAmount = bnToNumberEth(amount);
    const subject = `💲 Account topped up - ${formattedAmount} ETH to ${address}`;
    const recipients = [user.email];
    const body = `Your account ${address} has been credited with ${formattedAmount} ETH in transaction ${txHash}.
Your total balance is now ${bnToNumberEth(balance)} ETH`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function accountTopUpError(user: User, address: string, txHash: string, amount: BigNumber): Promise<void> {
  const cacheKey = `ACCOUNT_TOP_UP_ERROR:${txHash}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const formattedAmount = bnToNumberEth(amount);
    const subject = `💲❌ Account top up ERROR - ${formattedAmount} ETH to ${address}`;
    const recipients = [user.email];
    const body = `The system failed to credit ${address} with ${formattedAmount} ETH in transaction ${txHash} due to an error.`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

/** ************
 ** ADMIN emails
 ** ************/

async function adminRedemptionStart(deposit: Deposit): Promise<void> {
  const cacheKey = `ADMIN:REDEMPTION_START:${deposit.depositAddress}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const lotSizeBtc = bnToNumberBtc(deposit.lotSizeSatoshis);
    const subject = `🚀 Redemption started - ${lotSizeBtc} BTC ${deposit.depositAddress}`;
    const recipients = ADMIN_EMAIL_RECIPIENTS;
    const body = `Redemption of deposit ${deposit.depositAddress} (${lotSizeBtc} BTC) has started due to being close to liquidation courtesy call.`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function adminRedemptionComplete(deposit: Deposit): Promise<void> {
  const cacheKey = `ADMIN:REDEMPTION_COMPLETE:${deposit.depositAddress}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const lotSizeBtc = bnToNumberBtc(deposit.lotSizeSatoshis);
    const subject = `✅ Redemption complete - ${lotSizeBtc} BTC ${deposit.depositAddress}`;
    const recipients = ADMIN_EMAIL_RECIPIENTS;
    const body = `Redemption of deposit ${deposit.depositAddress} (${lotSizeBtc} BTC) completed successfully.`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function adminRedemptionError(deposit: Deposit, error: Error): Promise<void> {
  const cacheKey = `ADMIN:REDEMPTION_ERROR:${deposit.depositAddress}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const lotSizeBtc = bnToNumberBtc(deposit.lotSizeSatoshis);
    const subject = `❌ Redemption ERROR - ${lotSizeBtc} BTC ${deposit.depositAddress}`;
    const recipients = ADMIN_EMAIL_RECIPIENTS;
    const body = `Redemption of deposit ${deposit.depositAddress} (${lotSizeBtc} BTC) failed due to an error:
${error.message}

${error.stack}`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function adminAccountBalanceLow(address: string, formattedBalance: number, currency: string): Promise<void> {
  const cacheKey = `ADMIN:ACCOUNT_BALANCE_LOW:${currency}`;
  const cacheTtl = 1 * HOUR_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const subject = `💸 Account balance low - ${formattedBalance} ${currency} at ${address}`;
    const recipients = ADMIN_EMAIL_RECIPIENTS;
    const body = `System account ${address} ${currency} balance is running low and is currently ${formattedBalance} ${currency}.`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function adminSystemBalanceAnomaly(
  address: string,
  formattedPrevBalance: number,
  formattedNewBalance: number,
  currency: string
): Promise<void> {
  const cacheKey = `ADMIN:SYSTEM_BALANCE_ANOMALY:${currency}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const subject = `⚠ System ${currency} balance anomaly - ${formattedPrevBalance} => ${formattedNewBalance}`;
    const recipients = ADMIN_EMAIL_RECIPIENTS;
    const body = `The system detected an anomaly in ${currency} balance of system address ${address}.
Balance before redemption: ${formattedPrevBalance}
Balance after redemption: ${formattedNewBalance}`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

async function adminGenericError(source: string, error: Error): Promise<void> {
  const cacheKey = `ADMIN:GENERIC_ERROR:${source}`;
  const cacheTtl = 10 * MINUTE_MILLIS;

  const getEmailParams: EmailParamsGetter = async () => {
    const subject = `❌ ERROR - ${error.message.substr(0, 50)}`;
    const recipients = ADMIN_EMAIL_RECIPIENTS;
    const body = `The system encountered the following error in ${source}:
  ${error.message}

  ${error.stack}`;

    return { recipients, subject, body };
  };

  await send({
    getEmailParams,
    cacheKey,
    cacheTtl,
  });
}

// cache is used to avoid sending multiple copies of the same email in rapid succession (aka spam)
async function send({
  getEmailParams,
  cacheKey,
  cacheTtl,
}: {
  getEmailParams: EmailParamsGetter;
  cacheKey: string;
  cacheTtl: number;
}): Promise<void> {
  if (cache.get(cacheKey)) {
    logger.debug(`Email for key ${cacheKey} found in cache, not sending.`);
    return;
  }

  const { recipients, subject, body } = await getEmailParams();

  if (recipients.length === 0) {
    logger.debug(`Email for key ${cacheKey} has no recipients, not sending.`);
    return;
  }

  logger.info(`Sending email(s) ${cacheKey} to ${recipients.join(',')}...`);

  const bodyWithFooter = `${body}


Sent by Keeper - liquidation preventer tool for the KEEP network`;

  await postSender.request({
    Messages: [
      {
        From: {
          Email: EMAIL_SENDER,
          Name: 'Keeper',
        },
        To: recipients.map((email) => ({
          Email: email,
        })),
        Subject: subject,
        TextPart: bodyWithFooter,
      },
    ],
  });

  cache.put(cacheKey, true, cacheTtl);
  logger.debug(`Put email key ${cacheKey} in cache for ${cacheTtl}ms.`);
}

export default {
  redemptionStart,
  redemptionComplete,
  redemptionError,
  accountBalanceLow,
  accountToppedUp,
  accountTopUpError,
  admin: {
    redemptionStart: adminRedemptionStart,
    redemptionComplete: adminRedemptionComplete,
    redemptionError: adminRedemptionError,
    accountBalanceLow: adminAccountBalanceLow,
    genericError: adminGenericError,
    systemBalanceAnomaly: adminSystemBalanceAnomaly,
  },
};
