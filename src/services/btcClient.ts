/* eslint-disable camelcase */
import ElectrumClient from 'electrum-client-js';
import * as bjs from 'bitcoinjs-lib';
import bip84 from 'bip84';
import fetch from 'node-fetch';

import { ELECTRUMX_HOST, ELECTRUMX_PORT, ELECTRUMX_PROTOCOL, ELECTRUMX_NETWORK, BTC_ZPRV } from '../env';
import { createLogger } from '../logger';

const logger = createLogger('btcClient');
interface IRawTx {
  blockhash: string;
  blocktime: number;
  confirmations: number;
  hash: string;
  hex: string;
  size: number;
  time: number;
  txid: string; // matches "txhash" parameter
  vin: ITxVin[];
  vout: ITxVout[];
  vsize: number;
  weight: number;
}

interface ITxVin {
  txid: string;
  scriptSig: {
    asm: string;
    hex: string;
  };
  txinwitness: string[];
  sequence: number;
  vout: number;
}

interface ITxVout {
  value: number;
  n: number;
  scriptPubKey: {
    asm: string;
    hex: string;
    type: string;
    reqSigs: number;
    addresses: string[];
  };
}

interface IRawBalance {
  confirmed: number;
  unconfirmed: number;
}

interface IRawHitoryItem {
  tx_hash: string;
  height: number;
}

interface IUTXO extends IRawUTXO {
  pubKey: string;
  keyIndex: number;
  keyIsChange: boolean;
}
interface IRawUTXO {
  tx_hash: string;
  tx_pos: number;
  height: number;
  value: number;
}

interface IFeeEstimate {
  fastestFee: number;
  halfOurFee: number;
  hourFree: number;
}

const MAX_ADDRESS_GAP = 10;
const AMOUNT_MULTIPLIER = 100000000;
// eslint-disable-next-line new-cap
const btcAccount = new bip84.fromZPrv(BTC_ZPRV);

/*
BIP44 refers to the accepted common standard to derive non segwit addresses. These addresses always begin with a 1.
BIP49 refers to the accepted common standard of deriving segwit "compatibility" addresses. These addresses begin with a 3.
BIP84 refers to the accepted common standard of deriving native segwit addresses. These addresses always begin with bc1 - and are referred to bech32 addresses.
*/

function getAddress(index: number, isChange = false): string {
  return btcAccount.getAddress(index, isChange);
}

// https://cypherpunks-core.github.io/bitcoinbook/ch07.html
// Pay-to-Witness-Public-Key-Hash (P2WPKH)
async function send(toAddress: string, amount: number): Promise<string> {
  // PSBT = Partially Signed Bitcoin Transaction https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
  const psbt = new bjs.Psbt({ network: getNetworkFromEnv() });

  const utxos = await getUnspentUtxosZpubSelf();
  const txs = await getTxsForUtxos(utxos);
  const { fastestFee } = await estimateFee();
  const estimatedByteLength = utxos.length * 150 + 100;
  const estimatedFee = fastestFee * estimatedByteLength;
  const totalUtxoValue = utxos.reduce<number>((sum: number, u) => sum + u.value, 0);
  const estimatedAmountAndFee = amount + estimatedFee;
  if (totalUtxoValue < estimatedAmountAndFee) {
    throw new Error(`Insufficient funds. Required: ${amount}, available: ${estimatedAmountAndFee}`);
  }

  // for simplicity, always use all UTXOs
  txs.forEach((tx, i) => {
    const utxo = utxos[i];
    const txFromHex = bjs.Transaction.fromHex(tx.hex);
    const witnessOut = txFromHex.outs[utxo.tx_pos];

    psbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_pos,
      witnessUtxo: {
        script: witnessOut.script,
        value: witnessOut.value,
      },
    });
  });

  // actual payment
  psbt.addOutput({
    address: toAddress,
    value: amount,
  });

  const byteLength = getByteLength(psbt.clone(), utxos, amount);
  const fee = byteLength * fastestFee;
  // console.log('calculated fee', fee);

  // get change back
  const lastUtxo = utxos[utxos.length - 1];
  const changeAddress = btcAccount.getAddress(lastUtxo.keyIndex, true);
  psbt.addOutput({
    address: changeAddress,
    value: totalUtxoValue - (amount + fee),
  });

  utxos.forEach((utxo, i) => {
    const keyPair = bjs.ECPair.fromWIF(btcAccount.getPrivateKey(utxo.keyIndex, utxo.keyIsChange), getNetworkFromEnv());
    psbt.signInput(i, keyPair);
  });

  // console.log('valid signature: ', psbt.validateSignaturesOfAllInputs());
  psbt.finalizeAllInputs();
  const rawHex = psbt.extractTransaction().toHex();
  // console.log(rawHex);
  // console.log('amount', amount);
  // console.log('totalUtxos', totalUtxoValue);
  // console.log('fee', psbt.getFee());
  // console.log('feeRate', psbt.getFeeRate());
  // console.log('vsize', psbt.extractTransaction().virtualSize());
  // console.log('blength', psbt.extractTransaction().byteLength());
  // console.log('blength allow witness', psbt.extractTransaction().byteLength(true));
  // console.log(txs);

  const txHash = await requestAndClose((client) => client.blockchain_transaction_broadcast(rawHex));

  return txHash;
}

function getByteLength(psbt: bjs.Psbt, utxos: IUTXO[], amountToSend: number): number {
  const lastUtxo = utxos[utxos.length - 1];
  const changeAddress = btcAccount.getAddress(lastUtxo.keyIndex, true);
  const totalUtxoValue = utxos.reduce<number>((sum: number, u) => sum + u.value, 0);
  psbt.addOutput({
    address: changeAddress,
    value: totalUtxoValue - amountToSend,
  });

  utxos.forEach((utxo, i) => {
    const keyPair = bjs.ECPair.fromWIF(btcAccount.getPrivateKey(utxo.keyIndex, utxo.keyIsChange), getNetworkFromEnv());
    psbt.signInput(i, keyPair);
  });

  psbt.finalizeAllInputs();

  return psbt.extractTransaction().byteLength();
}

async function getTxsForUtxos(utxos: IUTXO[]): Promise<IRawTx[]> {
  const txs: any[] = [];

  await requestAndClose(async (client) => {
    for (const utxo of utxos) {
      const tx: IRawTx = await client.blockchain_transaction_get(utxo.tx_hash, true);
      txs.push(tx);
    }
  });

  return txs;
}

async function getUnspentUtxosZpubSelf(): Promise<IUTXO[]> {
  return getUnspentUtxosZpub(btcAccount.getAccountPublicKey());
}

async function getUnspentUtxosZpub(zpub: string): Promise<IUTXO[]> {
  let allUtxos: IUTXO[] = [];

  await requestAndClose(async (client) => {
    // eslint-disable-next-line new-cap
    const account = new bip84.fromZPub(zpub);

    let addressGapLimitReached = false;
    let currentAddressGap = 0;
    let currentIndex = 0;
    let isChange = false;

    while (!addressGapLimitReached) {
      const address = account.getAddress(currentIndex, isChange);
      const scriptHash = addressToScriptHash(address);
      const rawUtxos: IRawUTXO[] = await client.blockchain_scripthash_listunspent(scriptHash);
      // eslint-disable-next-line no-loop-func
      const utxos: IUTXO[] = rawUtxos.map((utxo) => ({
        ...utxo,
        pubKey: address,
        keyIndex: currentIndex,
        keyIsChange: isChange,
      }));

      allUtxos = [...allUtxos, ...utxos];

      if (utxos.length === 0) {
        currentAddressGap += 1;
      }

      if (isChange) {
        currentIndex += 1;
      }

      isChange = !isChange;
      addressGapLimitReached = currentAddressGap >= MAX_ADDRESS_GAP;
    }
  });

  return allUtxos;
}

async function getUnspentUtxos(address: string): Promise<IRawUTXO[]> {
  const scriptHash = addressToScriptHash(address);
  const rawUtxos = await requestAndClose((client) => client.blockchain_scripthash_listunspent(scriptHash));

  return rawUtxos;
}

async function waitForTransactionToAddress(address: string): Promise<any> {
  const scriptHash = addressToScriptHash(address);
  const tx = await requestAndClose((client) => client.blockchain_scripthash_subscribe(scriptHash));

  return tx;
}

async function waitForConfirmations(txHash: string, minConfirmations = 3): Promise<IRawTx> {
  const tx = await getTransaction(txHash);

  if (tx.confirmations >= minConfirmations) {
    return tx;
  }

  await waitForNextBlock();

  return waitForConfirmations(txHash, minConfirmations);
}

async function waitForNextBlock(): Promise<any> {
  const res = await requestAndClose((client) => client.blockchain_headers_subscribe());

  return res;
}

async function getTransaction(txHash: string): Promise<IRawTx> {
  const tx = await requestAndClose((client) => client.blockchain_transaction_get(txHash, true));

  return tx;
}

async function getBalanceZpubSelf(): Promise<IRawBalance> {
  return getBalanceZpub(btcAccount.getAccountPublicKey());
}

async function getBalanceZpub(zpub: string): Promise<IRawBalance> {
  const totalBalance: IRawBalance = {
    confirmed: 0,
    unconfirmed: 0,
  };
  await requestAndClose(async (client) => {
    // eslint-disable-next-line new-cap
    const account = new bip84.fromZPub(zpub);

    let addressGapLimitReached = false;
    let currentAddressGap = 0;
    let currentIndex = 0;
    let isChange = false;

    while (!addressGapLimitReached) {
      const address = account.getAddress(currentIndex, isChange);
      const scriptHash = addressToScriptHash(address);
      const balance: IRawBalance = await client.blockchain_scripthash_getBalance(scriptHash);

      totalBalance.confirmed += balance.confirmed;
      totalBalance.unconfirmed += balance.unconfirmed;

      const history: IRawHitoryItem[] = await client.blockchain_scripthash_getHistory(scriptHash);
      // console.log('history', history);

      if (history.length === 0 && !isChange) {
        currentAddressGap += 1;
      }

      if (isChange) {
        currentIndex += 1;
      }

      isChange = !isChange;
      addressGapLimitReached = currentAddressGap >= MAX_ADDRESS_GAP;
    }
  });

  return totalBalance;
}

async function getBalance(address: string): Promise<IRawBalance> {
  const scriptHash = addressToScriptHash(address);
  const balance = await requestAndClose((client) => client.blockchain_scripthash_getBalance(scriptHash));

  return balance;
}

function addressToScriptHash(address: string): string {
  const script = bjs.address.toOutputScript(address, getNetworkFromEnv());
  return Buffer.from(bjs.crypto.sha256(script).reverse()).toString('hex');
}

function getNetworkFromEnv(): bjs.networks.Network {
  switch (ELECTRUMX_NETWORK) {
    case 'bitcoin': {
      return bjs.networks.bitcoin;
    }
    case 'testnet': {
      return bjs.networks.testnet;
    }
    case 'regtest': {
      return bjs.networks.regtest;
    }
    default: {
      throw new Error(`unsupported network: ${ELECTRUMX_NETWORK}`);
    }
  }
}

async function requestAndClose<T>(fn: (client: ElectrumClient) => Promise<T>): Promise<T> {
  const electrumClient = new ElectrumClient(ELECTRUMX_HOST, ELECTRUMX_PORT, ELECTRUMX_PROTOCOL);

  try {
    await electrumClient.connect('electrum-client-js', '1.4.2');
    const res = await fn(electrumClient);

    return res;
  } finally {
    electrumClient.close();
  }
}

async function estimateFee(): Promise<IFeeEstimate> {
  let estimate: IFeeEstimate = {
    fastestFee: 1,
    halfOurFee: 1,
    hourFree: 1,
  };
  if (getNetworkFromEnv() === bjs.networks.bitcoin) {
    logger.debug('fetching btc fee estimate from bitcoinfees...');
    const res = await fetch('https://bitcoinfees.earn.com/api/v1/fees/recommended');
    estimate = await res.json();
  }
  logger.debug(`btc fee estimate: ${JSON.stringify(estimate)}`);

  return estimate;
}

// send('tb1qft4ua8wgd2z7ra8jq05wfp66kuzhlwf2548cts', 123).then(console.log);

// getUnspentUtxosZpubSelf().then(console.log);

// getBalanceZpubSelf().then(console.log);
// getUnspentUtxosZpubSelf().then(console.log);

// console.log(getAddress(1));
// console.log(getAddress(2));

// getUnspentUtxosZpub(
//   'vpub5ZLXP5vktbtx2ZEgeKaq8mrXrDeGzWMe8u7tZxCqwK8xoTcwX2avGHJRn3hCB17b57x76Q8Wb6voQBVPGpGBQbDmFLQnsYidWgTZeBWh65R'
// ).then((utxos) => {
//   let total = 0;

//   // eslint-disable-next-line no-return-assign
//   utxos.forEach((utxo: any) => (total += utxo.value));

//   console.log(total);

//   console.log(utxos);
// });

export default {
  send,
  waitForTransactionToAddress,
  waitForConfirmations,
  getAddress,
  getTransaction,
  getBalance,
  getBalanceZpub,
  getBalanceZpubSelf,
};
