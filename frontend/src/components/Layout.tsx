import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';
import { LocaleToggle } from './LocaleToggle';
import { StudentBar } from './StudentBar';

export function Layout({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  useLocale();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header" role="banner">
        <div className="app-header__inner app-header__top">
          <NavLink to="/" className="brand">
            {t('brand.name')}
          </NavLink>
          <div className="app-header__right">
            <nav aria-label="Main">
              <ul className="nav">
                <li>
                  <NavLink to="/" end>
                    {t('nav.classes')}
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/me">{t('nav.mine')}</NavLink>
                </li>
                <li>
                  <NavLink to="/admin">{t('nav.admin')}</NavLink>
                </li>
              </ul>
            </nav>
            <LocaleToggle />
          </div>
        </div>
      </header>
      {/* Only the student identity (and the offline banner) stays pinned, so phones keep most of the screen. */}
      <div className="student-strip">
        {banner}
        <div className="app-header__inner">
          <StudentBar />
        </div>
      </div>
      <main id="main" className="page" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
