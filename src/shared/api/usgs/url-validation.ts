import { ValidationError } from '../../errors';

export const DEFAULT_USGS_DETAIL_HOSTS: readonly string[] = Object.freeze(['earthquake.usgs.gov']);
const DEFAULT_USGS_DETAIL_HOST_SET = new Set(DEFAULT_USGS_DETAIL_HOSTS);

export function validateUsgsHttpsUrl(
  value: string,
  allowedHosts: readonly string[] = DEFAULT_USGS_DETAIL_HOSTS,
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error: unknown) {
    throw new ValidationError('La URL externa de USGS no es válida.', [], error);
  }

  const normalizedHosts =
    allowedHosts === DEFAULT_USGS_DETAIL_HOSTS
      ? DEFAULT_USGS_DETAIL_HOST_SET
      : new Set(allowedHosts.map((host) => host.trim().toLowerCase()));
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') {
    throw new ValidationError('La URL externa de USGS debe usar HTTPS.');
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new ValidationError('La URL externa de USGS no puede incluir credenciales.');
  }
  if (url.port !== '' && url.port !== '443') {
    throw new ValidationError('La URL externa de USGS usa un puerto no permitido.');
  }
  if (!normalizedHosts.has(hostname)) {
    throw new ValidationError('La URL externa no pertenece a un host permitido de USGS.');
  }

  url.hash = '';
  return url;
}

export function validateUsgsDetailUrl(
  value: string,
  allowedHosts: readonly string[] = DEFAULT_USGS_DETAIL_HOSTS,
): URL {
  return validateUsgsHttpsUrl(value, allowedHosts);
}
