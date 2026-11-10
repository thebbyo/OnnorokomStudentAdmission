import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StudentProvider } from '../state/StudentContext';
import { StudentBar } from './StudentBar';

const STORAGE_KEY = 'admission.studentId';

function renderBar() {
  return render(
    <StudentProvider>
      <StudentBar />
    </StudentProvider>,
  );
}

describe('StudentBar', () => {
  it('counts digits and enables Save only at 17', async () => {
    const user = userEvent.setup();
    renderBar();
    const input = screen.getByLabelText(/birth registration number/i);
    const save = screen.getByRole('button', { name: /save/i });

    await user.type(input, '123456789012');
    expect(screen.getByText('12/17')).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.type(input, '34567');
    expect(screen.getByText('17/17')).toBeInTheDocument();
    expect(save).toBeEnabled();
  });

  it('ignores non-digits while typing', async () => {
    const user = userEvent.setup();
    renderBar();
    const input = screen.getByLabelText(/birth registration number/i);
    await user.type(input, '12ab-3');
    expect(input).toHaveValue('123');
  });

  it('saves to localStorage and survives a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = renderBar();
    await user.type(screen.getByLabelText(/birth registration number/i), '20152691234567890');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe('20152691234567890');
    unmount();

    renderBar(); // simulates a page reload
    expect(screen.getByText('20152691234567890')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change student/i })).toBeInTheDocument();
  });

  it('ignores a corrupted stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-number');
    renderBar();
    expect(screen.getByLabelText(/birth registration number/i)).toHaveValue('');
  });

  it('Change student clears the id and focuses the input', async () => {
    localStorage.setItem(STORAGE_KEY, '20152691234567890');
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: /change student/i }));

    const input = screen.getByLabelText(/birth registration number/i);
    expect(input).toHaveFocus();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('submits with Enter', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.type(screen.getByLabelText(/birth registration number/i), '20152691234567890{Enter}');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('20152691234567890');
  });
});
