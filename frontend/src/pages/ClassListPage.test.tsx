import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { STUDENT, classStats, json, mockServer, renderApp } from '../test/helpers';

describe('ClassListPage', () => {
  it('shows skeletons first, then classes with seat numbers', async () => {
    mockServer(({ path }) => (path === '/classes' ? json(200, [classStats()]) : json(200, [])));
    renderApp('/');

    expect(screen.getByTestId('classes-loading')).toBeInTheDocument();
    const card = await screen.findByRole('article', { name: 'Class 6 - Morning Shift' });
    expect(within(card).getByText('25 of 120 available')).toBeInTheDocument();
    expect(within(card).getByText(/80 confirmed/)).toBeInTheDocument();
    expect(within(card).getByText(/15 on hold/)).toBeInTheDocument();
  });

  it('marks a class with no seats as Full and disables Apply', async () => {
    mockServer(() => json(200, [classStats({ heldSeats: 20, confirmedSeats: 100, availableSeats: 0 })]));
    renderApp('/', { studentId: STUDENT });

    const card = await screen.findByRole('article', { name: 'Class 6 - Morning Shift' });
    expect(within(card).getByText('Full')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /apply/i })).toBeDisabled();
  });

  it('disables Apply with a hint when no student id is set', async () => {
    mockServer(() => json(200, [classStats()]));
    renderApp('/');

    const card = await screen.findByRole('article', { name: 'Class 6 - Morning Shift' });
    expect(within(card).getByRole('button', { name: /apply/i })).toBeDisabled();
    expect(screen.getByText("Enter the student's birth registration number above to apply.")).toBeInTheDocument();
  });

  it("shows the student's own active application instead of Apply", async () => {
    mockServer(({ path }) =>
      path === '/me/holds'
        ? json(200, [
            {
              holdId: 'h_x',
              classId: 'c_1',
              className: 'Class 6 - Morning Shift',
              status: 'HELD',
              expiresAt: new Date(Date.now() + 300_000).toISOString().replace(/\.\d+Z$/, 'Z'),
            },
          ])
        : json(200, [classStats()]),
    );
    renderApp('/', { studentId: STUDENT });

    const card = await screen.findByRole('article', { name: 'Class 6 - Morning Shift' });
    const link = await within(card).findByRole('link', { name: /view your application/i });
    expect(link).toHaveAttribute('href', '/holds/h_x');
    expect(within(card).queryByRole('button', { name: /^apply/i })).not.toBeInTheDocument();
  });

  it('shows the reconnecting banner when the server cannot be reached', async () => {
    mockServer(() => 'network-error');
    renderApp('/');

    expect(await screen.findByText("Can't reach the admission server. Retrying…")).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(); // page is not blank
  });

  it('offers a next step when there are no classes', async () => {
    mockServer(() => json(200, []));
    renderApp('/');

    expect(await screen.findByText('No classes are open for admission yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create a class/i })).toHaveAttribute('href', '/admin');
  });

  it('applies, shows progress, and opens the new application', async () => {
    let release: () => void = () => {};
    mockServer(({ method, path, headers }) => {
      if (method === 'POST' && path === '/classes/c_1/holds') {
        expect(headers['X-Student-Id']).toBe(STUDENT);
        return new Promise((resolve) => {
          release = () =>
            resolve(
              json(201, { holdId: 'h_new', classId: 'c_1', studentId: STUDENT, status: 'HELD', expiresAt: '2030-01-01T00:00:00Z' }),
            );
        });
      }
      return path === '/me/holds' ? json(200, []) : json(200, [classStats()]);
    });
    const user = userEvent.setup();
    renderApp('/', { studentId: STUDENT });

    const card = await screen.findByRole('article', { name: 'Class 6 - Morning Shift' });
    await user.click(within(card).getByRole('button', { name: 'Apply' }));
    expect(within(card).getByRole('button', { name: 'Applying…' })).toBeDisabled();

    release();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/holds/h_new'));
  });

  it('explains SEATS_FULL on the card', async () => {
    mockServer(({ method, path }) => {
      if (method === 'POST') return json(409, { error: 'SEATS_FULL', message: 'full' });
      return path === '/me/holds' ? json(200, []) : json(200, [classStats({ availableSeats: 1 })]);
    });
    const user = userEvent.setup();
    renderApp('/', { studentId: STUDENT });

    const card = await screen.findByRole('article', { name: 'Class 6 - Morning Shift' });
    await user.click(within(card).getByRole('button', { name: 'Apply' }));

    expect(await within(card).findByText('All seats in this class are taken. Try another class or shift.')).toBeInTheDocument();
  });
});
