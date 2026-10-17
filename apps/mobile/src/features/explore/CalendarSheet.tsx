import { MonthCalendar } from '@/shared/ui/MonthCalendar';
import { Sheet } from '@/shared/ui/Sheet';

import type { useExploreViewModel } from './useExploreViewModel';

type CalendarSheetProps = ReturnType<typeof useExploreViewModel>['calendar'];

/** «Tria el dia»: el calendari en un full. En tocar un dia, es tria la nit i es tanca. */
export function CalendarSheet({
  visible,
  title,
  closeLabel,
  onClose,
  ...calendar
}: CalendarSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
      <MonthCalendar {...calendar} />
    </Sheet>
  );
}
