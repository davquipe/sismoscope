import { UsgsEarthquakeGateway } from '@/shared/api/usgs';

export const earthquakeGateway = new UsgsEarthquakeGateway({ timeoutMs: 15_000 });
