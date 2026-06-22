import { constants } from 'node:fs/promises';
import childProcess from 'child_process';
import { Buffer, } from 'buffer';
import { describe, expect, test, } from '@jest/globals';
import { getOwnIpAddresses, wrapIpv6, } from 'manner.js/server';
import DistribStorage from '~/class/DistribStorage';

describe('[Class] DistribStorage;', () => {
  test('DistribStorage should support IPv4 address.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv4, } = ipAddress;
    const storages = [
      [ipv4, 8000],
      [ipv4, 8001],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test1', {
    }, 8000, storages);
    const distribStorage2 = new DistribStorage('/tmp/test2', {
    }, 8001, storages);
  });

  test('DistribStorage should support IPv6 address.', async () => {
    const [ipAddress] = getOwnIpAddresses();
    const { ipv6, } = ipAddress;
    const storages = [
      [ipv6, 8000],
      [ipv6, 8001],
    ];
    const distribStorage1 = new DistribStorage('/tmp/test1', {
    }, 8000, storages);
    const distribStorage2 = new DistribStorage('/tmp/test2', {
    }, 8001, storages);
  });

  test('DistribStorage should be able to perform big data related operations.', async () => {
  });
});
