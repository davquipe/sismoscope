import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRepositoryUrl } from '@/shared/config/public';

describe('public repository configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses an explicit HTTPS repository URL when configured', () => {
    vi.stubEnv('VITE_REPOSITORY_URL', 'https://github.com/example/quake-observatory');

    expect(getRepositoryUrl({ hostname: 'example.test', pathname: '/' })).toBe(
      'https://github.com/example/quake-observatory',
    );
  });

  it('derives the owner and project name on GitHub Pages', () => {
    vi.stubEnv('VITE_REPOSITORY_URL', '');

    expect(
      getRepositoryUrl({ hostname: 'open-science.github.io', pathname: '/earthquakes/' }),
    ).toBe('https://github.com/open-science/earthquakes');
  });

  it('supports a user site hosted at the domain root', () => {
    vi.stubEnv('VITE_REPOSITORY_URL', '');

    expect(getRepositoryUrl({ hostname: 'open-science.github.io', pathname: '/' })).toBe(
      'https://github.com/open-science/open-science.github.io',
    );
  });

  it('does not expose invalid or non-HTTPS destinations', () => {
    vi.stubEnv('VITE_REPOSITORY_URL', 'http://github.com/example/repository');

    expect(getRepositoryUrl({ hostname: 'example.test', pathname: '/' })).toBeNull();
  });
});
