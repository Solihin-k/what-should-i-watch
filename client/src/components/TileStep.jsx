import VibeTile from './VibeTile.jsx';

export default function TileStep({ question, tiles, onSelect, multiSelect, selectedTileIds, onConfirm }) {
  return (
    <div className="animate-fadeSlideIn">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{question}</h2>
      {multiSelect && (
        <p className="text-xs text-gray-500 mb-3">Select one or more, then tap Continue</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <VibeTile
            key={tile.id}
            icon={tile.icon}
            label={tile.label}
            selected={multiSelect && selectedTileIds?.includes(tile.id)}
            onClick={() => onSelect(tile.id)}
          />
        ))}
      </div>
      {multiSelect && (
        <button
          type="button"
          disabled={!selectedTileIds || selectedTileIds.length === 0}
          onClick={onConfirm}
          className="mt-4 w-full py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      )}
    </div>
  );
}
