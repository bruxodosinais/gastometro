import Navigation from '@/components/Navigation';
import { PeriodProvider } from '@/lib/periodContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <Navigation />
      <div className="pb-20 md:pb-0 md:pl-64">
        {children}
      </div>
    </PeriodProvider>
  );
}
