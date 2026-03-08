export default function ProgressBar({ currentStep, totalSteps }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">Step {currentStep + 1} of {totalSteps}</p>
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
