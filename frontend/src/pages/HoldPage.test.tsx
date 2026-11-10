import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FakeRequest } from '../test/helpers';
import { STUDENT, classStats, json, mockServer, renderApp } from '../test/helpers';

interface HoldFixture {
  holdId: string;
  classId: string;
  className?: string;
  studentId?: string;
  status: string;
  expiresAt: string;
}

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

function heldHold(overrides: Partial<HoldFixture> = {}): HoldFixture {
  return {
    holdId: 'h_1',
    classId: 'c_1',
    className: 'Class 6 - Morning Shift',
    studentId: STUDENT,
    status: 'HELD',
    expiresAt: inMinutes(5),
    ...overrides,
  };
}

function serve(
  state: { hold: HoldFixture; available?: number },
  extra?: (req: FakeRequest) => Response | Promise<Response> | undefined,
) {
  return mockServer(async (req) => {
    const custom = extra?.(req);
    if (custom) return custom;
    if (req.method === 'GET' && req.path === '/holds/h_1') return json(200, state.hold);
    if (req.method === 'GET' && req.path === '/classes/c_1') return json(200, classStats({ availableSeats: state.available ?? 5 }));
    if (req.path === '/me/holds') return json(200, []);
    return json(404, { error: 'NOT_FOUND', message: 'nope' });
  });
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

describe('HoldPage', () => {
  it('flips to EXPIRED at zero without a reload and disables Pay', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    // The server never sweeps in this test: the UI must expire the hold on its own clock.
    serve({ hold: heldHold({ expiresAt: '2026-11-10T10:00:03Z' }) });
    renderApp('/holds/h_1', { studentId: STUDENT });
    await flush();

    const pay = screen.getByRole('button', { name: /pay admission fee/i });
    expect(pay).toBeEnabled();
    expect(screen.getByRole('timer')).toHaveTextContent('00:03');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(screen.getAllByText('Expired').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /pay admission fee/i })).toBeDisabled();
  });

  it('warns in words, not only colour, under a minute', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    serve({ hold: heldHold({ expiresAt: '2026-11-10T10:00:45Z' }) });
    renderApp('/holds/h_1', { studentId: STUDENT });
    await flush();

    expect(screen.getByText(/Less than a minute left/)).toBeInTheDocument();
  });

  it('pays, shows progress, then the confirmed state', async () => {
    const state = { hold: heldHold() };
    let release: () => void = () => {};
    serve(state, (req) => {
      if (req.method === 'POST' && req.path === '/holds/h_1/confirm') {
        expect(req.headers['X-Student-Id']).toBe(STUDENT);
        return new Promise((resolve) => {
          release = () => {
            state.hold = { ...state.hold, status: 'CONFIRMED' };
            resolve(json(200, { holdId: 'h_1', status: 'CONFIRMED' }));
          };
        }) as Promise<Response>;
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderApp('/holds/h_1', { studentId: STUDENT });

    await user.click(await screen.findByRole('button', { name: /pay admission fee/i }));
    expect(screen.getByRole('button', { name: 'Paying…' })).toBeDisabled();

    release();
    expect(await screen.findByRole('heading', { name: 'Admission confirmed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay admission fee/i })).not.toBeInTheDocument();
  });

  it('sends one confirm on a double click', async () => {
    const state = { hold: heldHold() };
    const server = serve(state, (req) =>
      req.method === 'POST' ? json(200, { holdId: 'h_1', status: 'CONFIRMED' }) : undefined,
    );
    const user = userEvent.setup();
    renderApp('/holds/h_1', { studentId: STUDENT });

    await user.dblClick(await screen.findByRole('button', { name: /pay admission fee/i }));

    const confirms = server.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(confirms).toHaveLength(1);
  });

  it('asks before cancelling, and can keep the seat', async () => {
    const state = { hold: heldHold() };
    const server = serve(state, (req) => {
      if (req.method === 'DELETE') {
        state.hold = { ...state.hold, status: 'CANCELLED' };
        return new Response(null, { status: 204 });
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderApp('/holds/h_1', { studentId: STUDENT });

    await user.click(await screen.findByRole('button', { name: /cancel application/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: /keep my seat/i })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: /keep my seat/i }));
    expect(server.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false);

    await user.click(screen.getByRole('button', { name: /cancel application/i }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /yes, cancel/i }));

    expect((await screen.findAllByText('Cancelled')).length).toBeGreaterThan(0);
  });

  it('offers Apply again after expiry when seats exist', async () => {
    serve({ hold: heldHold({ status: 'EXPIRED', expiresAt: inMinutes(-1) }), available: 3 });
    renderApp('/holds/h_1', { studentId: STUDENT });
    expect(await screen.findByRole('button', { name: /apply again/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /pay admission fee/i })).toBeDisabled();
  });

  it('says why Apply again is not possible when the class is full', async () => {
    serve({ hold: heldHold({ status: 'EXPIRED', expiresAt: inMinutes(-1) }), available: 0 });
    renderApp('/holds/h_1', { studentId: STUDENT });
    expect(await screen.findByText("Apply again isn't possible. This class is full right now.")).toBeInTheDocument();
  });

  it('applies again and opens the new application', async () => {
    serve({ hold: heldHold({ status: 'EXPIRED', expiresAt: inMinutes(-1) }), available: 3 }, (req) =>
      req.method === 'POST' && req.path === '/classes/c_1/holds'
        ? json(201, { holdId: 'h_2', classId: 'c_1', studentId: STUDENT, status: 'HELD', expiresAt: inMinutes(10) })
        : undefined,
    );
    const user = userEvent.setup();
    renderApp('/holds/h_1', { studentId: STUDENT });
    await user.click(await screen.findByRole('button', { name: /apply again/i }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/holds/h_2');
  });

  it('explains FORBIDDEN in plain language', async () => {
    const { studentId: _ignored, ...withoutOwner } = heldHold();
    serve({ hold: withoutOwner as HoldFixture }, (req) =>
      req.method === 'POST' ? json(403, { error: 'FORBIDDEN', message: 'no' }) : undefined,
    );
    const user = userEvent.setup();
    renderApp('/holds/h_1', { studentId: STUDENT });
    await user.click(await screen.findByRole('button', { name: /pay admission fee/i }));

    expect(await screen.findByText(/This application belongs to a different student/)).toBeInTheDocument();
  });

  it('warns up front when the hold belongs to someone else', async () => {
    serve({ hold: heldHold({ studentId: '99999999999999999' }) });
    renderApp('/holds/h_1', { studentId: STUDENT });
    expect(await screen.findByText(/This application belongs to a different student/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay admission fee/i })).toBeDisabled();
  });

  it('shows a friendly not-found state', async () => {
    mockServer(({ path }) =>
      path === '/holds/h_1' ? json(404, { error: 'HOLD_NOT_FOUND', message: 'x' }) : json(200, []),
    );
    renderApp('/holds/h_1', { studentId: STUDENT });
    expect(await screen.findByText("We couldn't find this application. Open it from My applications.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my applications/i })).toHaveAttribute('href', '/me');
  });

  it('disables Pay and Cancel with a hint when no student id is set', async () => {
    serve({ hold: heldHold() });
    renderApp('/holds/h_1');
    expect(await screen.findByRole('button', { name: /pay admission fee/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel application/i })).toBeDisabled();
    expect(screen.getByText("Enter the student's birth registration number above to pay or cancel.")).toBeInTheDocument();
  });
});

describe('HoldPage seat-count failure', () => {
  it('explains when the seat count cannot be loaded for an ended hold', async () => {
    mockServer(({ path }) => {
      if (path === '/holds/h_1') return json(200, heldHold({ status: 'EXPIRED', expiresAt: inMinutes(-1) }));
      if (path === '/classes/c_1') return json(500, { error: 'INTERNAL', message: 'x' });
      return json(200, []);
    });
    renderApp('/holds/h_1', { studentId: STUDENT });
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply again/i })).not.toBeInTheDocument();
  });

  it('sends the student header when loading the hold, so the owner check can work', async () => {
    const server = mockServer(({ path }) => (path === '/holds/h_1' ? json(200, heldHold()) : json(200, [])));
    renderApp('/holds/h_1', { studentId: STUDENT });
    await screen.findByRole('button', { name: /pay admission fee/i });
    const holdCall = server.mock.calls.find(([url]) => String(url).endsWith('/holds/h_1'));
    expect((holdCall?.[1] as RequestInit).headers).toMatchObject({ 'X-Student-Id': STUDENT });
  });
});
