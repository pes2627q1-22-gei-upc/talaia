import type { Pla } from '@talaia/shared';
import { View } from 'react-native';

import { makeStyles } from '@/core/theme/theme';
import { spacing } from '@/core/theme/tokens';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { PlanFormView } from './NewPlanScreen';
import { useEditPlanViewModel, usePlanLoader } from './useEditPlanViewModel';

const SKELETON_BLOCKS = [56, 96, 56, 120];

function EditPlanForm({ plan }: { plan: Pla }) {
  return <PlanFormView vm={useEditPlanViewModel(plan)} />;
}

/** «Edita el pla» (`/pla/[id]`, HU14, TG-161): el formulari de «Crea un pla» amb el pla desat. */
export function EditPlanScreen({ planId }: { planId: string }) {
  const styles = useStyles();
  const vm = usePlanLoader(planId);
  if (vm.plan) return <EditPlanForm plan={vm.plan} />;

  return (
    <Screen title={vm.title} back={vm.back} edges={['top', 'bottom']}>
      {vm.state === 'loading' ? (
        <View style={styles.loading} testID="edit-plan-loading">
          {SKELETON_BLOCKS.map((height, index) => (
            <Skeleton key={index} height={height} radius="md" />
          ))}
        </View>
      ) : vm.state === 'missing' ? (
        <StateMessage
          fill
          title={vm.missing.title}
          message={vm.missing.message}
          action={vm.missing.action}
        />
      ) : (
        <StateMessage fill title={vm.error.title} action={vm.error.action} />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  loading: { gap: spacing.ms },
}));
