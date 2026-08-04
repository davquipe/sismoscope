import { UsgsEarthquakeGateway } from '@/shared/api/usgs';
import { NetworkError, ValidationError } from '@/shared/errors';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usgsCollectionFixture } from '../../fixtures/usgs';

describe('UsgsEarthquakeGateway', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests and parses the GeoJSON count response', async () => {
    let requestedUrl = '';
    const fetchImpl: typeof fetch = (input) => {
      requestedUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return Promise.resolve(
        new Response(JSON.stringify({ count: 137, maxAllowed: 20_000 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    };
    const gateway = new UsgsEarthquakeGateway({ fetchImpl });

    await expect(gateway.count({ minMagnitude: 4.5 })).resolves.toBe(137);
    const url = new URL(requestedUrl);
    expect(url.pathname.endsWith('/count')).toBe(true);
    expect(url.searchParams.get('minmagnitude')).toBe('4.5');
  });

  it('normalizes a realtime feed and preserves typed metadata', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify(usgsCollectionFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/geo+json' },
        }),
      );
    const gateway = new UsgsEarthquakeGateway({ fetchImpl });

    const result = await gateway.getRealtimeFeed('all_day');
    expect(result.events[0]?.id).toBe('us-test-1');
    expect(result.metadata.apiVersion).toBe('2.7.0');
  });

  it('rejects an arbitrary detail URL before issuing a request', async () => {
    let requestCount = 0;
    const fetchImpl: typeof fetch = () => {
      requestCount += 1;
      return Promise.resolve(new Response('{}'));
    };
    const gateway = new UsgsEarthquakeGateway({ fetchImpl });

    await expect(gateway.getDetail('https://example.com/event.json')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(requestCount).toBe(0);
  });

  it('classifies transport failures as network errors', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new TypeError('connection refused'));
    const gateway = new UsgsEarthquakeGateway({ fetchImpl });

    await expect(gateway.getRealtimeFeed('all_hour')).rejects.toBeInstanceOf(NetworkError);
  });

  it('classifies HTTP 429 separately and reads Retry-After', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(new Response('{}', { status: 429, headers: { 'Retry-After': '7' } }));
    const gateway = new UsgsEarthquakeGateway({ fetchImpl });

    const request = gateway.getRealtimeFeed('all_hour');
    await expect(request).rejects.toMatchObject({
      kind: 'rate-limit',
      retryAfterSeconds: 7,
    });
  });

  it('does not convert caller cancellation into a network failure', async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('cancelled', 'AbortError')),
          { once: true },
        );
      });
    const gateway = new UsgsEarthquakeGateway({ fetchImpl });
    const controller = new AbortController();

    const request = gateway.getRealtimeFeed('all_hour', { signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('converts its own timeout into a recoverable timeout error', async () => {
    vi.useFakeTimers();
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('timed out', 'AbortError')),
          { once: true },
        );
      });
    const gateway = new UsgsEarthquakeGateway({ fetchImpl, timeoutMs: 50 });

    const assertion = expect(gateway.getRealtimeFeed('all_hour')).rejects.toMatchObject({
      kind: 'network',
      code: 'REQUEST_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});
