export default function VibeTile({ icon, label, onClick, selected, compact }) {
  const base = compact
    ? 'rounded-xl p-3 border-2 shadow-sm hover:shadow-md active:scale-95 transition-all duration-150 cursor-pointer flex items-center gap-2'
    : 'rounded-xl p-4 border-2 shadow-sm hover:shadow-md active:scale-95 transition-all duration-150 cursor-pointer flex flex-col items-center gap-2';

  const colors = selected
    ? 'border-indigo-600 bg-indigo-50'
    : 'border-gray-200 bg-white';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${colors}`}
    >
      <span className={compact ? 'text-xl' : 'text-3xl'}>{icon}</span>
      <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-800`}>{label}</span>
    </button>
  );
}
