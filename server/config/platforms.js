// Tier 1 platforms — full TMDB/JustWatch coverage at launch, Singapore-first
// tmdbProviderId and logo_path sourced from TMDB /watch/providers/tv?watch_region=SG
// logoUrl format: https://image.tmdb.org/t/p/original{logo_path}
const PLATFORMS = [
  {
    id: 'netflix',
    name: 'Netflix',
    logoUrl: 'https://image.tmdb.org/t/p/original/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
    tmdbProviderId: 8,
    brandColor: '#E50914',
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    logoUrl: 'https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ot.jpg',
    tmdbProviderId: 337,
    brandColor: '#113CCF',
  },
  {
    id: 'hbo-max',
    name: 'HBO Go/Max',
    logoUrl: 'https://image.tmdb.org/t/p/original/jbe4gVSfRlbPTdESXhEKpornsfu.jpg',
    tmdbProviderId: 1899,
    brandColor: '#000000',
  },
  {
    id: 'amazon-prime',
    name: 'Amazon Prime Video',
    logoUrl: 'https://image.tmdb.org/t/p/original/pvske1MyAoymrs5bguRfVqYiM9a.jpg',
    tmdbProviderId: 119,
    brandColor: '#00A8E1',
  },
  {
    id: 'viu',
    name: 'Viu',
    logoUrl: 'https://image.tmdb.org/t/p/original/o7WsYI2r1llIf9h6JTGVX9yTHPx.jpg',
    tmdbProviderId: 158,
    brandColor: '#FFCC00',
  },
  {
    id: 'apple-tv',
    name: 'Apple TV+',
    logoUrl: 'https://image.tmdb.org/t/p/original/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg',
    tmdbProviderId: 350,
    brandColor: '#555555',
  },
];

export default PLATFORMS;
