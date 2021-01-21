/* eslint-disable camelcase */
import ElectrumClient from 'electrum-client-js';
import * as bjs from 'bitcoinjs-lib';
import bip84 from 'bip84';
import fetch from 'node-fetch';
import { BigNumber } from 'ethers';

import { ELECTRUMX_HOST, ELECTRUMX_PORT, ELECTRUMX_PROTOCOL, ELECTRUMX_NETWORK, BTC_ZPRV } from '../env';
import { createLogger } from '../logger';
import { getAddressAtIndex } from './ethClient';
import { numberToBnBtc } from '../utils';
import { IFundingProof } from '../types';
import BitcoinHelpers from './BitcoinHelpers';

export interface IRawTx {
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

interface IBlockHeader {
  height: number;
  hex: string;
}

interface IMerkleProof {
  proof: string;
  position: number;
}

const logger = createLogger('btcClient');

const MAX_ADDRESS_GAP = 10;
const NETWORK = getNetworkFromEnv();
const TEST_ADDRESS = getAddressAtIndex(999999); // "random" address for fee estimation
// eslint-disable-next-line new-cap
const wallet = new bip84.fromZPrv(BTC_ZPRV);

BitcoinHelpers.setElectrumConfig({
  protocol: ELECTRUMX_PROTOCOL,
  server: ELECTRUMX_HOST,
  port: ELECTRUMX_PORT,
});

/*
BIP44 refers to the accepted common standard to derive non segwit addresses. These addresses always begin with a 1.
BIP49 refers to the accepted common standard of deriving segwit "compatibility" addresses. These addresses begin with a 3.
BIP84 refers to the accepted common standard of deriving native segwit addresses. These addresses always begin with bc1 - and are referred to bech32 addresses.
*/

function getAddress(index: number, isChange = false): string {
  return wallet.getAddress(index, isChange);
}

// https://cypherpunks-core.github.io/bitcoinbook/ch07.html
// Pay-to-Witness-Public-Key-Hash (P2WPKH)
async function send(toAddress: string, amount: number): Promise<string> {
  // PSBT = Partially Signed Bitcoin Transaction https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
  const psbt = new bjs.Psbt({ network: NETWORK });

  const utxos = await getUnspentUtxosZpubSelf();
  const txs = await getTxsForUtxos(utxos);
  const { fastestFee } = await estimateFee();
  const estimatedByteLength = utxos.length * 150 + 100; // rough estimate of how many bytes the tx will take up
  const estimatedFee = fastestFee * estimatedByteLength;
  const totalUtxoValue = utxos.reduce<number>((sum: number, u) => sum + u.value, 0);
  const estimatedAmountAndFee = amount + estimatedFee;
  if (totalUtxoValue < estimatedAmountAndFee) {
    throw new Error(`Insufficient funds. Required (estimate): ${amount}, available: ${estimatedAmountAndFee}`);
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
  const actualAmountAndFee = amount + fee;
  if (totalUtxoValue < actualAmountAndFee) {
    throw new Error(`Insufficient funds. Required: ${amount}, available: ${actualAmountAndFee}`);
  }

  // get change back
  const lastUtxo = utxos[utxos.length - 1];
  const changeAddress = wallet.getAddress(lastUtxo.keyIndex, true);
  psbt.addOutput({
    address: changeAddress,
    value: totalUtxoValue - (amount + fee),
  });

  utxos.forEach((utxo, i) => {
    const keyPair = bjs.ECPair.fromWIF(wallet.getPrivateKey(utxo.keyIndex, utxo.keyIsChange), NETWORK);
    psbt.signInput(i, keyPair);
  });

  psbt.finalizeAllInputs();
  const rawHex = psbt.extractTransaction().toHex();

  const txHash = await requestAndClose((client) => client.blockchain_transaction_broadcast(rawHex));

  return txHash;
}

// TODO: this is mostly duplicated code, try to extract common code from this and 'send()'
async function estimateSendFee(amount: number, toAddress = TEST_ADDRESS): Promise<number> {
  // PSBT = Partially Signed Bitcoin Transaction https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki
  const psbt = new bjs.Psbt({ network: NETWORK });

  const utxos = await getUnspentUtxosZpubSelf();
  const txs = await getTxsForUtxos(utxos);
  const { fastestFee } = await estimateFee();

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
  return byteLength * fastestFee;
}

function getByteLength(psbt: bjs.Psbt, utxos: IUTXO[], amountToSend: number): number {
  const lastUtxo = utxos[utxos.length - 1];
  const changeAddress = wallet.getAddress(lastUtxo.keyIndex, true);
  const totalUtxoValue = utxos.reduce<number>((sum: number, u) => sum + u.value, 0);
  psbt.addOutput({
    address: changeAddress,
    value: totalUtxoValue - amountToSend,
  });

  utxos.forEach((utxo, i) => {
    const keyPair = bjs.ECPair.fromWIF(wallet.getPrivateKey(utxo.keyIndex, utxo.keyIsChange), NETWORK);
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
  return getUnspentUtxosZpub(wallet.getAccountPublicKey());
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

async function waitForTransactionToAddress(address: string, minValueSatoshis: BigNumber): Promise<IRawTx> {
  const txs = await getTxHistory(address);
  const tx = txs.reverse().find((t) =>
    t.vout.some((v) => {
      const isRecipientCurrentAddress = v.scriptPubKey.addresses
        .map((a) => a.toLowerCase())
        .includes(address.toLowerCase());
      const valueSatoshis = numberToBnBtc(v.value);
      return isRecipientCurrentAddress && valueSatoshis.gte(minValueSatoshis);
    })
  );

  if (tx) {
    return tx;
  }

  await waitForNextBlock();

  return waitForConfirmations(address);
}

async function waitForConfirmations(txHash: string, minConfirmations = 3): Promise<IRawTx> {
  const tx = await getTransaction(txHash);

  if (tx.confirmations >= minConfirmations) {
    return tx;
  }

  await waitForNextBlock();

  return waitForConfirmations(txHash, minConfirmations);
}

async function waitForNextBlock(): Promise<IBlockHeader> {
  const res = await requestAndClose((client) => client.blockchain_headers_subscribe());

  return res;
}

async function getTransaction(txHash: string): Promise<IRawTx> {
  const tx = await requestAndClose((client) => client.blockchain_transaction_get(txHash, true));

  return tx;
}

async function getBalanceZpubSelf(): Promise<IRawBalance> {
  return getBalanceZpub(wallet.getAccountPublicKey());
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

async function getTxHistory(address: string): Promise<IRawTx[]> {
  const scriptHash = addressToScriptHash(address);
  return requestAndClose(async (client) => {
    const history: IRawHitoryItem[] = await client.blockchain_scripthash_getHistory(scriptHash);
    const txs: IRawTx[] = [];
    for (const h of history) {
      const tx = await client.blockchain_transaction_get(h.tx_hash, true);
      txs.push(tx);
    }
    return txs;
  });
}

async function getBalance(address: string): Promise<IRawBalance> {
  const scriptHash = addressToScriptHash(address);
  const balance = await requestAndClose((client) => client.blockchain_scripthash_getBalance(scriptHash));

  return balance;
}

function addressToScriptHash(address: string): string {
  return Buffer.from(bjs.crypto.sha256(addressToScript(address)).reverse()).toString('hex');
}

function addressToScript(address: string): Buffer {
  return bjs.address.toOutputScript(address, NETWORK);
}

function getNetworkFromEnv(): bjs.networks.Network {
  switch (ELECTRUMX_NETWORK) {
    case 'mainnet': {
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
  if (NETWORK === bjs.networks.bitcoin) {
    logger.debug('fetching btc fee estimate from bitcoinfees...');
    const res = await fetch('https://bitcoinfees.earn.com/api/v1/fees/recommended');
    estimate = await res.json();
  }
  logger.debug(`btc fee estimate: ${JSON.stringify(estimate)}`);

  return estimate;
}

function addressToRedeemerScript(address: string): string {
  const rawOutputScript = addressToScript(address);
  const redeemerOutputScript = `0x${Buffer.concat([Buffer.from([rawOutputScript.length]), rawOutputScript]).toString(
    'hex'
  )}`;

  return redeemerOutputScript;
}

async function constructFundingProof(
  txid: string,
  outputPosition: number,
  confirmations: number
): Promise<IFundingProof> {
  const { parsedTransaction, merkleProof, chainHeaders, txInBlockIndex } = await BitcoinHelpers.Transaction.getSPVProof(
    txid,
    confirmations
  );
  const { version, txInVector, txOutVector, locktime } = parsedTransaction;

  // return [
  //   Buffer.from(version, 'hex'),
  //   Buffer.from(txInVector, 'hex'),
  //   Buffer.from(txOutVector, 'hex'),
  //   Buffer.from(locktime, 'hex'),
  //   outputPosition,
  //   Buffer.from(merkleProof, 'hex'),
  //   txInBlockIndex,
  //   Buffer.from(chainHeaders, 'hex'),
  // ];
  return {
    version: Buffer.from(version, 'hex'),
    inputVector: Buffer.from(txInVector, 'hex'),
    outputVector: Buffer.from(txOutVector, 'hex'),
    locktime: Buffer.from(locktime, 'hex'),
    outputPosition,
    merkleProof: Buffer.from(merkleProof, 'hex'),
    indexInBlock: txInBlockIndex,
    bitcoinHeaders: Buffer.from(chainHeaders, 'hex'),
  };
}

export {
  send,
  estimateSendFee,
  waitForTransactionToAddress,
  waitForConfirmations,
  getAddress,
  getTransaction,
  getTxHistory,
  getBalance,
  getBalanceZpub,
  getBalanceZpubSelf,
  addressToScript,
  addressToRedeemerScript,
  constructFundingProof,
};
