import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { STUDENT, classStats, json, mockServer, renderApp } from '../test/helpers';

function renderFullApp(path: string) {
  localStorage.setItem('admission.studentId', STUDENT);
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('language toggle', () => {
  it('switches the parent screens to Bangla and back, and remembers the choice', async () => {
    mockServer(() => json(200, [classStats()]));
    const user = userEvent.setup();
    renderFullApp('/');

    expect(await screen.findByRole('heading', { name: 'Classes open for admission' })).toBeInTheDocument();

    const header = screen.getByRole('banner');
    await user.click(within(header).getByRole('button', { name: 'বাংলা' }));

    expect(await screen.findByRole('heading', { name: 'ভর্তির জন্য উন্মুক্ত শ্রেণিসমূহ' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('bn');
    expect(localStorage.getItem('admission.locale')).toBe('bn');
    expect(within(header).getByRole('link', { name: 'আমার আবেদন' })).toBeInTheDocument();

    await user.click(within(header).getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('heading', { name: 'Classes open for admission' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('keeps the admin page in English', async () => {
    mockServer(() => json(200, []));
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'School admin' })).toBeInTheDocument();
  });
});
