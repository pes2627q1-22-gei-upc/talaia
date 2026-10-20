'use dom';

import type { DOMProps } from 'expo/dom';
import type { ComponentProps } from 'react';

import PointLocationMapContent from './PointLocationMapContent';

export default function PointLocationMap(
  props: ComponentProps<typeof PointLocationMapContent> & { dom?: DOMProps },
) {
  return <PointLocationMapContent {...props} />;
}
