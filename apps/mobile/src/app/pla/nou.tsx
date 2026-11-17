import { useLocalSearchParams } from 'expo-router';

import { NewPlanScreen } from '@/features/plans/NewPlanScreen';

export default function NewPlanRoute() {
  const { puntId, inici, esdevenimentId } = useLocalSearchParams<{
    puntId: string;
    inici?: string;
    esdevenimentId?: string;
  }>();
  return <NewPlanScreen puntId={puntId ?? ''} inici={inici} esdevenimentId={esdevenimentId} />;
}
