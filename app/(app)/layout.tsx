import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import TopbarDesktop from '@/components/TopbarDesktop';
import RecurringCheck from '@/components/RecurringCheck';
import FeedbackButton from '@/components/FeedbackButton';
import SupportButton from '@/components/SupportButton';
import WeeklyReportModal from '@/components/WeeklyReportModal';
import { PeriodProvider } from '@/lib/periodContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <RecurringCheck />
      <Sidebar />
      <TopbarDesktop />
      <Navigation />
      <div className="pb-20 lg:pb-0 lg:pl-[232px] lg:pt-[58px]">
        {children}
      </div>
      <FeedbackButton />
      <SupportButton />
      <WeeklyReportModal />
    </PeriodProvider>
  );
}
