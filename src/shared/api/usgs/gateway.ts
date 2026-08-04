import type {
  EarthquakeCollection,
  EarthquakeDetail,
  EarthquakeGateway,
  EarthquakeSearchQuery,
  EarthquakeSearchResult,
  GatewayRequestOptions,
  RealtimeFeed,
} from '../../../entities/earthquake/model';
import {
  HttpError,
  isAbortError,
  isAppError,
  NetworkError,
  RateLimitError,
  ValidationError,
} from '../../errors';
import { z } from 'zod';

import { DEFAULT_SEARCH_PAGE_SIZE, DEFAULT_USGS_TIMEOUT_MS, getRealtimeFeedConfig } from './config';
import { normalizeUsgsDetail, normalizeUsgsFeatureCollection } from './normalizers';
import { buildUsgsCountUrl, buildUsgsSearchUrl } from './query-builder';
import { usgsCountResponseSchema } from './schemas';
import { DEFAULT_USGS_DETAIL_HOSTS, validateUsgsDetailUrl } from './url-validation';

export interface UsgsEarthquakeGatewayConfig {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly allowedDetailHosts?: readonly string[];
}

interface AbortContext {
  readonly signal: AbortSignal;
  readonly didTimeout: () => boolean;
  readonly dispose: () => void;
}

function createAbortContext(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): AbortContext {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const handleExternalAbort = (): void => controller.abort();
  if (externalSignal?.aborted === true) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', handleExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      globalThis.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', handleExternalAbort);
    },
  };
}

function createAbortError(): DOMException {
  return new DOMException('La solicitud fue cancelada.', 'AbortError');
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
}

function validationIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || 'respuesta'}: ${issue.message}`);
}

export class UsgsEarthquakeGateway implements EarthquakeGateway {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly allowedDetailHosts: readonly string[];

  constructor(config: UsgsEarthquakeGatewayConfig = {}) {
    const timeoutMs = config.timeoutMs ?? DEFAULT_USGS_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError('timeoutMs debe ser un número positivo.');
    }

    this.fetchImpl = config.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = timeoutMs;
    this.allowedDetailHosts = config.allowedDetailHosts ?? DEFAULT_USGS_DETAIL_HOSTS;
  }

  async getRealtimeFeed(
    feed: RealtimeFeed,
    options: GatewayRequestOptions = {},
  ): Promise<EarthquakeCollection> {
    const url = getRealtimeFeedConfig(feed).url;
    const response = await this.requestJson(url, options.signal);
    return normalizeUsgsFeatureCollection(response);
  }

  async count(query: EarthquakeSearchQuery, options: GatewayRequestOptions = {}): Promise<number> {
    const response = await this.requestJson(buildUsgsCountUrl(query), options.signal);
    try {
      return usgsCountResponseSchema.parse(response).count;
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'USGS devolvió un conteo con un formato no válido.',
          validationIssues(error),
          error,
        );
      }
      throw error;
    }
  }

  async search(
    query: EarthquakeSearchQuery,
    options: GatewayRequestOptions = {},
  ): Promise<EarthquakeSearchResult> {
    const response = await this.requestJson(buildUsgsSearchUrl(query), options.signal);
    const collection = normalizeUsgsFeatureCollection(response);
    const limit = query.limit ?? DEFAULT_SEARCH_PAGE_SIZE;
    const returned = collection.events.length;

    return {
      ...collection,
      page: {
        offset: query.offset ?? 1,
        limit,
        returned,
        hasMore: returned === limit,
      },
    };
  }

  async getDetail(
    detailUrl: string,
    options: GatewayRequestOptions = {},
  ): Promise<EarthquakeDetail> {
    const safeUrl = validateUsgsDetailUrl(detailUrl, this.allowedDetailHosts);
    const normalizedUrl = safeUrl.toString();
    const response = await this.requestJson(normalizedUrl, options.signal);
    return normalizeUsgsDetail(response, normalizedUrl);
  }

  private async requestJson(
    url: string,
    externalSignal: AbortSignal | undefined,
  ): Promise<unknown> {
    const abortContext = createAbortContext(externalSignal, this.timeoutMs);
    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        headers: { Accept: 'application/geo+json, application/json' },
        signal: abortContext.signal,
      });
    } catch (error: unknown) {
      abortContext.dispose();
      if (externalSignal?.aborted === true) throw createAbortError();
      if (abortContext.didTimeout()) {
        throw new NetworkError('La solicitud a USGS excedió el tiempo de espera.', {
          timeout: true,
          cause: error,
        });
      }
      if (isAppError(error)) throw error;
      if (isAbortError(error)) throw createAbortError();
      throw new NetworkError('No se pudo conectar con USGS.', { cause: error });
    }

    if (!response.ok) {
      abortContext.dispose();
      if (response.status === 429) {
        throw new RateLimitError(parseRetryAfter(response.headers.get('Retry-After')));
      }
      throw new HttpError(response.status, url);
    }

    try {
      return await response.json();
    } catch (error: unknown) {
      if (externalSignal?.aborted === true) throw createAbortError();
      if (abortContext.didTimeout()) {
        throw new NetworkError('La solicitud a USGS excedió el tiempo de espera.', {
          timeout: true,
          cause: error,
        });
      }
      throw new ValidationError('USGS devolvió una respuesta que no es JSON válido.', [], error);
    } finally {
      abortContext.dispose();
    }
  }
}
