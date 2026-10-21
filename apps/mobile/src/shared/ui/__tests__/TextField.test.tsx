import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from '../TextField';

it('té l’etiqueta com a nom accessible i avisa dels canvis', async () => {
  const onChangeText = jest.fn();
  await render(<TextField label="Correu electrònic" value="" onChangeText={onChangeText} />);
  await fireEvent.changeText(screen.getByLabelText('Correu electrònic'), 'nom@exemple.cat');
  expect(onChangeText).toHaveBeenCalledWith('nom@exemple.cat');
  expect(screen.queryByRole('alert')).toBeNull();
});

it("mostra l'error com a alerta", async () => {
  await render(<TextField label="Codi" value="" error="El codi no és correcte" />);
  expect(screen.getByRole('alert')).toHaveTextContent('El codi no és correcte');
});
