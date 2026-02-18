// Tier 1 platforms — full TMDB/JustWatch coverage at launch
// tmdbProviderId maps to TMDB's watch provider IDs (from JustWatch)
const PLATFORMS = [
  {
    id: 'netflix',
    name: 'Netflix',
    logoUrl: 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
    tmdbProviderId: 8,
    brandColor: '#E50914',
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    logoUrl: 'https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19d.jpg',
    tmdbProviderId: 337,
    brandColor: '#113CCF',
  },
  {
    id: 'amazon-prime',
    name: 'Amazon Prime Video',
    logoUrl: 'https://image.tmdb.org/t/p/original/68MNrwlkpF7WnmNPXLah69CR5xh.jpg',
    tmdbProviderId: 119,
    brandColor: '#00A8E1',
  },
  {
    id: 'apple-tv',
    name: 'Apple TV+',
    logoUrl: 'https://image.tmdb.org/t/p/original/6uhKBfmtzFqOcLousHwZuzcrScK.jpg',
    tmdbProviderId: 350,
    brandColor: '#000000',
  },
  {
    id: 'hbo-max',
    name: 'HBO Go/Max',
    logoUrl: 'https://image.tmdb.org/t/p/original/Ajqyt5aNxNGjmF9uOfxArGrdf3X.jpg',
    tmdbProviderId: 425,
    brandColor: '#A020F0',
  },
  {
    id: 'paramount-plus',
    name: 'Paramount+',
    logoUrl: 'https://image.tmdb.org/t/p/original/h5DcR0J2EESLitnhR8xLG1QymTE.jpg',
    tmdbProviderId: 531,
    brandColor: '#0064FF',
  },
];

export default PLATFORMS;
