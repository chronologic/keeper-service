import { Cache } from 'memory-cache';

interface ICache<T> {
  put: (key: string, value: T, ttl?: number) => T;
  get: (key: string) => T;
  keys: () => T[];
}

export function createTimedCache<T>(ttlMillis: number): ICache<T> {
  const cache = new Cache();

  return {
    put: (key: string, value: any, ttl = ttlMillis) => cache.put(key, value, ttl),
    get: (key: string) => cache.get(key),
    keys: () => cache.keys(),
  };
}
