import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STUDENT, json, mockServer, renderApp } from '../test/helpers';

const at = (iso: string) => iso;
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

function apps() {
  return [
    { holdId: 'h_c', classId: 'c_3', className: 'Class 8 - Day Shift', status: 'CANCELLED', expiresAt: at('2026-11-10T09:00:00Z') },
    { holdId: 'h_h', classId: 'c_1', className: 'Class 6 - Morning Shift', status: 'HELD', expiresAt: at('2026-11-10T10:00:05Z') },
    { holdId: 'h_e', classId: 'c_4', className: 'Class 9 - Morning Shift', status: 'EXPIRED', expiresAt: at('2026-11-10T09:30:00Z') },
    { holdId: 'h_k', classId: 'c_2', className: 'Class 7 - Morning Shift', status: 'CONFIRMED', expiresAt: at('2026-11-10T09:50:00Z') },
  ];
}

describe('MyApplicationsPage', () => {
  it('groups active applications first, each with a status badge and a link', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    mockServer(() => json(200, apps()));
    renderApp('/me', { studentId: STUDENT });
    await flush();

    const active = screen.getByRole('region', { name: /active/i });
    const past = screen.getByRole('region', { name: /past/i });
    expect(within(active).getByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(within(active).getByText('Class 7 - Morning Shift')).toBeInTheDocument();
    expect(within(past).getByText('Class 8 - Day Shift')).toBeInTheDocument();
    expect(within(past).getByText('Class 9 - Morning Shift')).toBeInTheDocument();
    expect(active.compareDocumentPosition(past) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(active).getByText('On hold')).toBeInTheDocument();
    expect(within(active).getByText('Confirmed')).toBeInTheDocument();
    expect(within(active).getByRole('link', { name: /open.*class 6 - morning shift/i })).toHaveAttribute('href', '/holds/h_h');
  });

  it('runs a live countdown on held items and expires them without a refetch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    mockServer(() => json(200, apps()));
    renderApp('/me', { studentId: STUDENT });
    await flush();

    expect(screen.getByText('00:05')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    const past = screen.getByRole('region', { name: /past/i });
    expect(within(past).getByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(within(past).getAllByText('Expired').length).toBe(2);
  });

  it('asks for the student id when none is set', () => {
    mockServer(() => json(200, []));
    renderApp('/me');
    expect(screen.getByText("Enter the student's birth registration number above to see applications.")).toBeInTheDocument();
  });

  it('offers a next step when there are no applications', async () => {
    mockServer(() => json(200, []));
    renderApp('/me', { studentId: STUDENT });
    expect(await screen.findByText('No applications yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse classes/i })).toHaveAttribute('href', '/');
  });

  it('keeps showing applications when the server drops out', async () => {
    let up = true;
    mockServer(() => (up ? json(200, apps()) : 'network-error'));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    renderApp('/me', { studentId: STUDENT });
    await flush();

    up = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.getByText('Class 7 - Morning Shift')).toBeInTheDocument();
    expect(screen.getByText("Can't reach the admission server. Retrying…")).toBeInTheDocument();
  });
});
