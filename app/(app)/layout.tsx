import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import TopbarDesktop from '@/components/TopbarDesktop';
import TopbarMobile from '@/components/TopbarMobile';
import RecurringCheck from '@/components/RecurringCheck';
import AuthGate from '@/components/AuthGate';
import AchievementToast from '@/components/AchievementToast';
import StreakFreezeToast from '@/components/StreakFreezeToast';
import MilestoneToast from '@/components/MilestoneToast';
import GoalMilestoneToast from '@/components/GoalMilestoneToast';
import RoundUpToast from '@/components/RoundUpToast';
import FeedbackButton from '@/components/FeedbackButton';
import SupportButton from '@/components/SupportButton';
import WeeklyReportModal from '@/components/WeeklyReportModal';
import { PeriodProvider } from '@/lib/periodContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PeriodProvider>
      <AuthGate />
      <RecurringCheck />
      <AchievementToast />
      <StreakFreezeToast />
      <MilestoneToast />
      <GoalMilestoneToast />
      <RoundUpToast />
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
