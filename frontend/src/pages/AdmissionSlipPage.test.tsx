import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { STUDENT, json, mockServer, renderApp } from '../test/helpers';

const paid = {
  holdId: 'h_1',
  classId: 'c_1',
  className: 'Class 6 – Morning Shift',
  studentId: STUDENT,
  status: 'CONFIRMED',
  expiresAt: '2026-11-10T10:05:00Z',
  admissionNo: 'ADM-2026-000123',
  confirmedAt: '2026-11-10T10:02:30Z',
};

describe('AdmissionSlipPage', () => {
  it('shows the admission number, student, class, status and paid time', async () => {
    mockServer(() => json(200, paid));
    renderApp('/holds/h_1/slip', { studentId: STUDENT });

    expect(await screen.findByText('ADM-2026-000123')).toBeInTheDocument();
    expect(screen.getByText(STUDENT)).toBeInTheDocument();
    expect(screen.getByText('Class 6 – Morning Shift')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText(/Paid/)).toBeInTheDocument();
  });

  it('has a Print button that opens the print dialog', async () => {
    mockServer(() => json(200, paid));
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const user = userEvent.setup();
    renderApp('/holds/h_1/slip', { studentId: STUDENT });

    await user.click(await screen.findByRole('button', { name: /print slip/i }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('explains that a slip is only available after payment', async () => {
    mockServer(() => json(200, { ...paid, status: 'HELD', admissionNo: undefined, confirmedAt: undefined }));
    renderApp('/holds/h_1/slip', { studentId: STUDENT });

    expect(await screen.findByText(/A slip is issued once the admission fee is paid/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to application/i })).toHaveAttribute('href', '/holds/h_1');
  });

  it('asks for the student id when none is set', () => {
    mockServer(() => json(200, paid));
    renderApp('/holds/h_1/slip');
    expect(screen.getByText("Enter the student's birth registration number above to see the slip.")).toBeInTheDocument();
  });
});
