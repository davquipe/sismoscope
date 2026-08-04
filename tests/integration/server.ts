import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { usgsCollectionFixture, usgsDetailFixture } from '../fixtures/usgs';

export const handlers = [
  http.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/:feed', () =>
    HttpResponse.json(usgsCollectionFixture),
  ),
  http.get('https://earthquake.usgs.gov/fdsnws/event/1/count', () =>
    HttpResponse.json({ count: 1, maxAllowed: 20_000 }),
  ),
  http.get('https://earthquake.usgs.gov/fdsnws/event/1/query', () =>
    HttpResponse.json(usgsCollectionFixture),
  ),
  http.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/:eventId', () =>
    HttpResponse.json(usgsDetailFixture),
  ),
];

export const server = setupServer(...handlers);
