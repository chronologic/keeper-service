/* eslint-disable max-classes-per-file */
/* eslint-disable camelcase */
declare module 'memory-cache';
declare module 'electrum-client-js' {
  export default class ElectrumClient {
    constructor(host: string, port: string, protocol: string, options?: any);

    connect(clientName: string, electrumProtocolVersion: string): Promise<void>;

    close(): void;

    server_version(client_name: string, protocol_version: string): Promise<any>;

    server_banner(): Promise<any>;

    server_ping(): Promise<any>;

    server_addPeer(features: any): Promise<any>;

    server_donation_address(): Promise<any>;

    server_features(): Promise<any>;

    server_peers_subscribe(): Promise<any>;

    blockchain_address_getProof(address: any): Promise<any>;

    blockchain_scripthash_getBalance(scripthash: any): Promise<any>;

    blockchain_scripthash_getHistory(scripthash: any): Promise<any>;

    blockchain_scripthash_getMempool(scripthash: any): Promise<any>;

    blockchain_scripthash_listunspent(scripthash: any): Promise<any>;

    blockchain_scripthash_subscribe(scripthash: any): Promise<any>;

    blockchain_scripthash_unsubscribe(scripthash: any): Promise<any>;

    blockchain_block_header(height: any, cpHeight: any): Promise<any>;

    blockchain_block_headers(startHeight: any, count: any, cpHeight: any): Promise<any>;

    blockchainEstimatefee(number: any): Promise<any>;

    blockchain_headers_subscribe(): Promise<any>;

    blockchain_relayfee(): Promise<any>;

    blockchain_transaction_broadcast(rawtx: any): Promise<any>;

    blockchain_transaction_get(tx_hash: any, verbose: any): Promise<any>;

    blockchain_transaction_getMerkle(tx_hash: any, height: any): Promise<any>;

    mempool_getFeeHistogram(): Promise<any>;
  }
}

declare module 'bip84' {
  interface FromZPrvConstructor {
    new (zprv: string): fromZPrv;
  }
  class fromZPrv {
    constructor(zprv: string);

    getAccountPrivateKey(): string;

    getAccountPublicKey(): string;

    getPrivateKey(index: number, isChange?: boolean): string;

    getPublicKey(index: number, isChange?: boolean): string;

    getAddress(index: number, isChange?: boolean): string;
  }
  interface FromZPubConstructor {
    new (zpub: string): fromZPub;
  }
  class fromZPub {
    constructor(zpub: string);

    getAccountPublicKey(): string;

    getPublicKey(index: number, isChange?: boolean): string;

    getAddress(index: number, isChange?: boolean): string;
  }

  const exported: {
    fromZPrv: FromZPrvConstructor;
    fromZPub: FromZPubConstructor;
  };

  export default exported;
}
