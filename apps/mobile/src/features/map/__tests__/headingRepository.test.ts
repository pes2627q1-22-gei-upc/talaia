import * as Location from 'expo-location';

import { watchDeviceHeading } from '../headingRepository';

jest.mock('expo-location', () => ({ watchHeadingAsync: jest.fn() }));

it('prefereix el nord real, recorre al magnètic i descarta lectures sense calibrar', async () => {
  const receive = jest.fn();
  await watchDeviceHeading(receive);
  const callback = jest.mocked(Location.watchHeadingAsync).mock.calls[0]![0];
  callback({ trueHeading: 45, magHeading: 43, accuracy: 3 });
  expect(receive).toHaveBeenLastCalledWith(45);
  callback({ trueHeading: -1, magHeading: 43, accuracy: 2 });
  expect(receive).toHaveBeenLastCalledWith(43);
  callback({ trueHeading: 45, magHeading: 43, accuracy: 0 });
  expect(receive).toHaveBeenLastCalledWith(null);
});
