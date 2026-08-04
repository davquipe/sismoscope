export const usgsFeatureFixture = {
  type: 'Feature',
  id: 'us-test-1',
  geometry: {
    type: 'Point',
    coordinates: [-77.0428, -12.0464, 33],
  },
  properties: {
    mag: 5.2,
    magType: 'mww',
    place: '20 km O de Lima, Perú',
    time: 1_704_067_200_000,
    updated: 1_704_067_260_000,
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us-test-1',
    detail: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us-test-1.geojson',
    felt: 12,
    cdi: 3.4,
    mmi: 4.1,
    alert: 'green',
    status: 'reviewed',
    tsunami: 0,
    sig: 420,
    net: 'us',
    nst: 48,
    dmin: 0.3,
    rms: 0.62,
    gap: 72,
    type: 'earthquake',
    title: 'M 5.2 - 20 km O de Lima, Perú',
  },
} as const;

export const usgsCollectionFixture = {
  type: 'FeatureCollection',
  metadata: {
    generated: 1_704_067_300_000,
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    title: 'USGS All Earthquakes, Past Day',
    status: 200,
    api: '2.7.0',
    count: 1,
  },
  bbox: [-77.0428, -12.0464, 33, -77.0428, -12.0464, 33],
  features: [usgsFeatureFixture],
} as const;

export const usgsDetailFixture = {
  ...usgsFeatureFixture,
  properties: {
    ...usgsFeatureFixture.properties,
    detail: undefined,
    products: {
      origin: [
        {
          id: 'urn:usgs-product:us:origin:us-test-1:1704067260000',
          type: 'origin',
          code: 'us-test-1',
          source: 'us',
          updateTime: 1_704_067_260_000,
          status: 'UPDATE',
          preferredWeight: 158,
          properties: {
            'review-status': 'reviewed',
            latitude: '-12.0464',
          },
          contents: {
            'contents.xml': {
              contentType: 'application/xml',
              lastModified: 1_704_067_260_000,
              length: 125,
              url: 'https://earthquake.usgs.gov/product/origin/us-test-1/contents.xml',
              sha256: 'abc123',
            },
          },
        },
      ],
    },
  },
} as const;
