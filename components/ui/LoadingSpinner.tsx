import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  variant?: 'fullscreen' | 'inline';
  size?: number;
  className?: string;
}

export default function LoadingSpinner({
  variant = 'inline',
  size = 20,
  className = '',
}: LoadingSpinnerProps) {
  if (variant === 'fullscreen') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={size} className={`animate-spin text-gray-400 ${className}`} />
      </div>
    );
  }
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}
