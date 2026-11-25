import { useLocalSearchParams } from 'expo-router';

import { EditPlanScreen } from '@/features/plans/EditPlanScreen';

export default function EditPlanRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditPlanScreen planId={id ?? ''} />;
}
