import vikiLogo from '../assets/viki-logo.png';

// Local logo overrides — used when the TMDB-hosted image is broken or unsuitable
const LOCAL_LOGOS = {
  'rakuten-viki': vikiLogo,
};

// PlatformLogo — shows platform image with a colored initial badge fallback
function PlatformLogo({ platform }) {
  const initials = platform.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const src = LOCAL_LOGOS[platform.id] ?? platform.logoUrl;

  return (
    <div className="relative w-8 h-8 shrink-0 overflow-hidden">
      <img
        src={src}
        alt={platform.name}
        className="w-8 h-8 rounded-md object-contain bg-gray-50"
        style={platform.logoStyle}
        onError={(e) => {
          // Hide broken image and reveal the colored initial badge beneath it
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextSibling.style.display = 'flex';
        }}
      />
      <div
        className="absolute inset-0 rounded-md items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: platform.brandColor, display: 'none' }}
      >
        {initials}
      </div>
    </div>
  );
}

// PlatformSelector — lets users pick which streaming services they have
// Selected platforms are highlighted with a branded border
export default function PlatformSelector({ platforms, selected, onChange }) {
  function togglePlatform(platformId) {
    if (selected.includes(platformId)) {
      onChange(selected.filter((id) => id !== platformId));
    } else {
      onChange([...selected, platformId]);
    }
  }

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Which platforms do you have?
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {platforms.map((platform) => {
          const isSelected = selected.includes(platform.id);
          return (
            <button
              key={platform.id}
              onClick={() => togglePlatform(platform.id)}
              style={isSelected ? { borderColor: platform.brandColor, borderWidth: '2px' } : {}}
              className={[
                'flex items-center gap-2 rounded-xl p-3 border transition-all duration-150',
                'bg-white shadow-sm hover:shadow-md active:scale-95',
                isSelected
                  ? 'ring-2'
                  : 'border-gray-200 hover:border-gray-300',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              <PlatformLogo platform={platform} />
              <span className="text-sm font-medium text-gray-700 leading-tight">
                {platform.name}
              </span>
              {isSelected && (
                <span
                  className="ml-auto text-xs font-bold"
                  style={{ color: platform.brandColor }}
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {selected.length} platform{selected.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}
