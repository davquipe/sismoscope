type PublicLocation = Pick<Location, 'hostname' | 'pathname'>;

export function getRepositoryUrl(location: PublicLocation = window.location): string | null {
  const configured = import.meta.env.VITE_REPOSITORY_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  if (location.hostname.endsWith('.github.io')) {
    const owner = location.hostname.slice(0, -'.github.io'.length);
    const [projectName] = location.pathname.split('/').filter(Boolean);
    const repositoryName = projectName ?? `${owner}.github.io`;

    if (/^[a-z0-9-]+$/i.test(owner) && /^[a-z0-9._-]+$/i.test(repositoryName)) {
      return `https://github.com/${owner}/${repositoryName}`;
    }
  }
  return null;
}
