import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScrollableTable } from '../ScrollableTable';

describe('Indicació de desplaçament de la taula', () => {
  it('apareix només si la taula no cap i permet accedir a la zona amb teclat', () => {
    let availableWidth = 300;
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => availableWidth);
    render(
      <ScrollableTable label="Llista de prova">
        <table>
          <tbody>
            <tr>
              <td>Contingut</td>
            </tr>
          </tbody>
        </table>
      </ScrollableTable>,
    );

    expect(screen.getByText(/Desplaça la taula horitzontalment/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Llista de prova' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    availableWidth = 600;
    fireEvent(window, new Event('resize'));
    expect(screen.queryByText(/Desplaça la taula horitzontalment/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Llista de prova' })).not.toBeInTheDocument();
  });
});
