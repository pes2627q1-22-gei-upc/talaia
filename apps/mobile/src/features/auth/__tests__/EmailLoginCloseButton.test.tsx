import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import i18n from '@/core/i18n';

import { EmailLoginCloseButton } from '../EmailLoginCloseButton';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

it('la creu té nom i tanca el full del correu', async () => {
  await i18n.changeLanguage('ca');
  await render(<EmailLoginCloseButton />);
  await fireEvent.press(screen.getByRole('button', { name: 'Tanca' }));
  expect(router.back).toHaveBeenCalledTimes(1);
});
