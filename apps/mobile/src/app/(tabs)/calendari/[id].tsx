import { useLocalSearchParams } from 'expo-router';

import { EventDetailScreen } from '@/features/event/EventDetailScreen';

export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventDetailScreen eventId={id} />;
}
