import Navigation from '@/components/Navigation';
import RecurringCheck from '@/components/RecurringCheck';
import { PeriodProvider } from '@/lib/periodContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <RecurringCheck />
      <Navigation />
      <div className="pb-20 md:pb-0 md:pl-64">
        {children}
      </div>
    </PeriodProvider>
  );
}
