import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { friendlyError } from '../api/messages';
import { dictionary, type Key } from './dictionary';
import { getLocale, setLocale, t } from './index';

afterEach(() => setLocale('en'));

describe('dictionary', () => {
  it('has the same keys in English and Bangla (no missing translation)', () => {
    const en = Object.keys(dictionary.en).sort();
    const bn = Object.keys(dictionary.bn).sort();
    expect(bn).toEqual(en);
  });

  it('has no empty strings', () => {
    for (const value of Object.values(dictionary.bn)) expect(value.trim().length).toBeGreaterThan(0);
    for (const value of Object.values(dictionary.en)) expect(value.trim().length).toBeGreaterThan(0);
  });
});

describe('t()', () => {
  it('defaults to English', () => {
    expect(getLocale()).toBe('en');
    expect(t('nav.classes')).toBe('Classes');
  });

  it('switches to Bangla when the locale changes', () => {
    setLocale('bn');
    expect(t('nav.classes')).toBe(dictionary.bn['nav.classes']);
    expect(t('nav.classes')).not.toBe('Classes');
  });

  it('fills in {placeholders}', () => {
    expect(t('classes.available', { available: 25, total: 120 })).toContain('25');
    expect(t('classes.available', { available: 25, total: 120 })).toContain('120');
  });

  it('keeps Western digits in Bangla (decision: no Bengali numerals)', () => {
    setLocale('bn');
    expect(t('classes.available', { available: 25, total: 120 })).toMatch(/25.*120|120.*25/);
  });
});

describe('locale persistence', () => {
  it('remembers the choice in localStorage', () => {
    setLocale('bn');
    expect(localStorage.getItem('admission.locale')).toBe('bn');
  });

  it('ignores an unknown stored value and stays English', () => {
    localStorage.setItem('admission.locale', 'fr');
    setLocale('en');
    expect(getLocale()).toBe('en');
  });
});

describe('error messages follow the locale', () => {
  it('translates SEATS_FULL', () => {
    setLocale('bn');
    expect(friendlyError(new ApiError('SEATS_FULL', 409, 'x'))).toBe(dictionary.bn['error.SEATS_FULL']);
  });

  it('keeps the English wording by default', () => {
    expect(friendlyError(new ApiError('SEATS_FULL', 409, 'x'))).toBe(
      'All seats in this class are taken. Try another class or shift.',
    );
  });
});

export type { Key };

describe('saved choice at start-up', () => {
  it('reads the saved language when the app loads again', async () => {
    localStorage.setItem('admission.locale', 'bn');
    const { vi } = await import('vitest');
    vi.resetModules();
    const fresh = await import('./index');
    expect(fresh.getLocale()).toBe('bn');
    localStorage.removeItem('admission.locale');
  });
});
