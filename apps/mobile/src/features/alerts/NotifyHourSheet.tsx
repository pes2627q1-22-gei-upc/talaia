import { Sheet } from '@/shared/ui/Sheet';
import { Button } from '@/shared/ui/Button';
import { WheelPicker } from '@/shared/ui/WheelPicker';

import type { useNewAlertViewModel } from './useNewAlertViewModel';

type NotifyHourSheetProps = ReturnType<typeof useNewAlertViewModel>['hourSheet'];

/** Full de l'hora de l'avís: una sola roda d'hores, com les de la franja d'Explora. */
export function NotifyHourSheet({
  visible,
  title,
  hours,
  format,
  value,
  onChange,
  doneLabel,
  onClose,
}: NotifyHourSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={doneLabel}>
      <WheelPicker
        testID="wheel-notify-hour"
        values={hours}
        value={value}
        onChange={onChange}
        format={format}
        accessibilityLabel={title}
      />
      <Button label={doneLabel} onPress={onClose} />
    </Sheet>
  );
}
