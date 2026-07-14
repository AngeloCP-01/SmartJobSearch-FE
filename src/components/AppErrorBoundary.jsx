import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { captureError } from '../observability/sentry';
import Button from './Button';

// React error boundaries must be class components. One component, two fallbacks:
// - variant="full": centered full-viewport card (wraps the whole app in main.jsx)
// - variant="page": fills the content area so the sidebar/nav survive (wraps the
//   routed <Outlet/> in Layout, keyed on the path so navigation auto-recovers).
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    captureError(error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    const full = this.props.variant === 'full';
    const wrapper = full
      ? 'flex min-h-screen items-center justify-center p-6'
      : 'flex min-h-[50vh] items-center justify-center p-6';

    return (
      <div className={wrapper}>
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 text-amber-500" size={32} aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-800">
            {full ? 'Something went wrong' : 'This page hit an error'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {full
              ? 'The app ran into an unexpected problem. Reloading usually fixes it.'
              : 'Something on this page failed to load. You can try again or navigate elsewhere.'}
          </p>
          <div className="mt-5">
            {full ? (
              <Button variant="primary" onClick={() => window.location.reload()}>Reload</Button>
            ) : (
              <Button variant="primary" onClick={this.reset}>Try again</Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
