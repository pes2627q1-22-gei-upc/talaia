import { useLocalSearchParams } from 'expo-router';

import { NewPlanScreen } from '@/features/plans/NewPlanScreen';

export default function NewPlanRoute() {
  const { puntId, inici, fi, esdevenimentId } = useLocalSearchParams<{
    puntId: string;
    inici?: string;
    fi?: string;
    esdevenimentId?: string;
  }>();
  return (
    <NewPlanScreen puntId={puntId ?? ''} inici={inici} fi={fi} esdevenimentId={esdevenimentId} />
  );
}
