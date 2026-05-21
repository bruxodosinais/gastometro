'use client';

type OnboardingProgressProps = {
  filled: number;
  totalSteps: number;
  label?: string;
  subActive?: number;
};

export function OnboardingProgress({
  filled,
  totalSteps,
  label,
  subActive,
}: OnboardingProgressProps) {
  return (
    <>
      <div className="flex gap-2 justify-center">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-colors duration-300"
            style={
              i < filled
                ? { background: 'var(--accent)' }
                : { border: '2px solid #e5e7eb' }
            }
          />
        ))}
      </div>
      {label && (
        <>
          <div className="h-6" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
            {label}
          </p>
          <div className="h-3" />
        </>
      )}
      {typeof subActive === 'number' && (
        <>
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={
                  i === subActive
                    ? { width: 20, background: 'var(--accent)' }
                    : { width: 8, background: '#e5e7eb' }
                }
              />
            ))}
          </div>
          <div className="h-4" />
        </>
      )}
    </>
  );
}
