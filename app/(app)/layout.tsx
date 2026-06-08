import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import TopbarDesktop from '@/components/TopbarDesktop';
import TopbarMobile from '@/components/TopbarMobile';
import RecurringCheck from '@/components/RecurringCheck';
import CoinToast from '@/components/CoinToast';
import StreakFreezeToast from '@/components/StreakFreezeToast';
import MilestoneToast from '@/components/MilestoneToast';
import GoalMilestoneToast from '@/components/GoalMilestoneToast';
import FeedbackButton from '@/components/FeedbackButton';
import SupportButton from '@/components/SupportButton';
import WeeklyReportModal from '@/components/WeeklyReportModal';
import { PeriodProvider } from '@/lib/periodContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <RecurringCheck />
      <CoinToast />
      <StreakFreezeToast />
      <MilestoneToast />
      <GoalMilestoneToast />
      <Sidebar />
      <TopbarDesktop />
      <TopbarMobile />
      <Navigation />
      <div className="pt-[52px] pb-20 lg:pt-[58px] lg:pb-0 lg:pl-[232px]">
        {children}
      </div>
      <FeedbackButton />
      <SupportButton />
      <WeeklyReportModal />
    </PeriodProvider>
  );
}
