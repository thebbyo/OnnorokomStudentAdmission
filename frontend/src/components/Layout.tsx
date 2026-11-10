import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { StudentBar } from './StudentBar';

export function Layout({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  return (
    <>
      <a className="visually-hidden" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        {banner}
        <div className="app-header__inner">
          <div className="app-header__top">
            <NavLink to="/" className="brand">
              School Admission
            </NavLink>
            <nav aria-label="Main">
              <ul className="nav">
                <li>
                  <NavLink to="/" end>
                    Classes
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/me">My applications</NavLink>
                </li>
                <li>
                  <NavLink to="/admin">School admin</NavLink>
                </li>
              </ul>
            </nav>
          </div>
          <StudentBar />
        </div>
      </header>
      <main id="main" className="page" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
