import { useLocalSearchParams } from 'expo-router';

import { PointDetailScreen } from '@/features/point/PointDetailScreen';

export default function PointRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PointDetailScreen pointId={id} />;
}
