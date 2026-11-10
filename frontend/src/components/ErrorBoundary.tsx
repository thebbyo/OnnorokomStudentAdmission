import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Last line of defence: a rendering bug shows a friendly page, never a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page">
        <div className="empty" role="alert">
          <h1>Something went wrong on this page</h1>
          <p>Your applications are safe on the server. Reload the page to continue.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
