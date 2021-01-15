import ElectrumClient from 'electrum-client-js';
import * as bjs from 'bitcoinjs-lib';

import { ELECTRUMX_HOST, ELECTRUMX_PORT, ELECTRUMX_PROTOCOL, ELECTRUMX_NETWORK } from '../env';

interface IBitcoinTxResponse {
  blockhash: string;
  blocktime: number;
  confirmations: number;
  hash: string;
  hex: string;
  size: number;
  time: number;
  txid: string; // matches "txhash" parameter
  vin: any[];
  vout: any[];
  vsize: number;
  weight: number;
}

interface IBitcoinBalanceResponse {
  confirmed: number;
  unconfirmed: number;
}

async function main() {}

async function getTransaction(txHash: string): Promise<IBitcoinTxResponse> {
  const res = await requestAndClose((client) => client.blockchain_transaction_get(txHash, true));

  return res;
}

async function getBalance(address: string): Promise<IBitcoinBalanceResponse> {
  const scriptHash = addressToScriptHash(address);
  const res = await requestAndClose((client) => client.blockchain_scripthash_getBalance(scriptHash));

  return res;
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

main();
