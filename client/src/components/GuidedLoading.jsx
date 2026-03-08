export default function GuidedLoading({ selections }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 animate-fadeSlideIn">
      <div className="flex gap-1 items-center text-gray-600">
        <span className="text-lg">Finding the perfect picks for you</span>
        <span className="animate-bounce [animation-delay:0ms]">.</span>
        <span className="animate-bounce [animation-delay:150ms]">.</span>
        <span className="animate-bounce [animation-delay:300ms]">.</span>
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        {selections.map((sel) => (
          <span
            key={sel.stepIndex}
            className="rounded-full px-3 py-1 bg-indigo-50 border border-indigo-200 text-sm text-indigo-700"
          >
            {sel.icon} {sel.label}
          </span>
        ))}
      </div>
    </div>
  );
}
