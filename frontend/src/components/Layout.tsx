import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { StudentBar } from './StudentBar';

export function Layout({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header__inner app-header__top">
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
