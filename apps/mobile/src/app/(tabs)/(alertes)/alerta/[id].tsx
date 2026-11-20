import { useLocalSearchParams } from 'expo-router';

import { EditAlertScreen } from '@/features/alerts/EditAlertScreen';

export default function EditAlertRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditAlertScreen alertId={id} />;
}
