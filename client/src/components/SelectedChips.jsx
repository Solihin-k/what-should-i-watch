export default function SelectedChips({ selections, onChipClick }) {
  if (selections.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {selections.map((sel) => (
        <button
          key={sel.stepIndex}
          type="button"
          onClick={() => onChipClick(sel.stepIndex)}
          className="rounded-full px-3 py-1.5 bg-white border border-gray-300 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
        >
          {sel.icon} {sel.label}
        </button>
      ))}
    </div>
  );
}
