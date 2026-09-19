import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes';
import { extractSharedFragment } from './share-bootstrap';
import './index.css';

// Strip a shared board out of the address bar before React mounts — and so
// before RootLayout's initAnalytics() can read window.location. A board in
// `$current_url`, a referrer or a session replay is exactly what this feature
// must never produce. See share-bootstrap.ts.
extractSharedFragment();

// vite-react-ssg owns hydration/mount. Marketing routes are prerendered to
// static HTML at build time; the editor (/app) is a client-only island.
export const createRoot = ViteReactSSG({ routes, basename: import.meta.env.BASE_URL });
