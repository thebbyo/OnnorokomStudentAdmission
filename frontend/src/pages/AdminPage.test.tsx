import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { json, mockServer, renderApp } from '../test/helpers';

const NAME_ERROR = 'Enter a class name, e.g. Class 6 – Morning Shift.';
const SEATS_ERROR = 'Seats must be a whole number from 1 to 100,000.';

function fields() {
  return {
    name: screen.getByLabelText(/class name/i),
    seats: screen.getByLabelText(/number of seats/i),
    submit: screen.getByRole('button', { name: /create class/i }),
  };
}

describe('AdminPage', () => {
  it('is clearly labelled as the school admin area', () => {
    mockServer(() => json(200, []));
    renderApp('/admin');
    expect(screen.getByRole('heading', { level: 1, name: /school admin/i })).toBeInTheDocument();
  });

  it('validates an empty name and moves focus to it', async () => {
    const server = mockServer(() => json(200, []));
    const user = userEvent.setup();
    renderApp('/admin');
    const { name, seats, submit } = fields();

    await user.type(seats, '10');
    await user.click(submit);

    expect(screen.getByText(NAME_ERROR)).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription(expect.stringContaining(NAME_ERROR));
    expect(name).toHaveFocus();
    expect(server.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it.each(['0', '-3', '1.5', '', '100001', 'abc'])('rejects seats %j', async (value) => {
    mockServer(() => json(200, []));
    const user = userEvent.setup();
    renderApp('/admin');
    const { name, seats, submit } = fields();

    await user.type(name, 'Class 7');
    if (value) await user.type(seats, value);
    await user.click(submit);

    expect(screen.getByText(SEATS_ERROR)).toBeInTheDocument();
    expect(seats).toHaveFocus();
  });

  it('creates the class, confirms, links to the list and resets the form', async () => {
    let sent: unknown;
    let release: () => void = () => {};
    mockServer(({ method, body }) => {
      if (method !== 'POST') return json(200, []);
      sent = body;
      return new Promise((resolve) => {
        release = () => resolve(json(201, { id: 'c_9', name: 'Class 6 - Day Shift', totalSeats: 90 }));
      });
    });
    const user = userEvent.setup();
    renderApp('/admin');
    const { name, seats, submit } = fields();

    await user.type(name, '  Class 6 - Day Shift  ');
    await user.type(seats, '90');
    await user.click(submit);

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    release();

    expect(await screen.findByText(/Class created/)).toBeInTheDocument();
    expect(sent).toEqual({ name: 'Class 6 - Day Shift', totalSeats: 90 });
    expect(screen.getByRole('link', { name: /view in class list/i })).toHaveAttribute('href', '/');
    await waitFor(() => expect(fields().name).toHaveValue(''));
    expect(fields().seats).toHaveValue('');
  });

  it("shows the server's validation message", async () => {
    mockServer(({ method }) =>
      method === 'POST' ? json(400, { error: 'VALIDATION_ERROR', message: '"name" must be at most 200 characters.' }) : json(200, []),
    );
    const user = userEvent.setup();
    renderApp('/admin');
    const { name, seats, submit } = fields();
    await user.type(name, 'A');
    await user.type(seats, '5');
    await user.click(submit);

    expect(await screen.findByText('"name" must be at most 200 characters.')).toBeInTheDocument();
  });

  it('explains when the server is unreachable', async () => {
    mockServer(() => 'network-error');
    const user = userEvent.setup();
    renderApp('/admin');
    const { name, seats, submit } = fields();
    await user.type(name, 'A');
    await user.type(seats, '5');
    await user.click(submit);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Can't reach the admission server/)).toBeInTheDocument();
  });
});
