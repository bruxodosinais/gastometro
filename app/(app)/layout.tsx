import Navigation from '@/components/Navigation';
import { PeriodProvider } from '@/lib/periodContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <div className="pb-20">{children}</div>
      <Navigation />
    </PeriodProvider>
  );
}
