import './globals.css';
import Link from 'next/link';
import GlobalSearch from '@/components/GlobalSearch';

export const metadata = {
  title: 'JOBSight',
  description: 'Developer Intelligence Tool for Job Hunting',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GlobalSearch />
        <div className="app-shell">
          <aside className="sidebar">
            <h1>JOBSight</h1>
            <nav>
              <Link href="/" className="nav-link">Overview</Link>
              <Link href="/radar" className="nav-link">Discovery Radar</Link>
              <Link href="/board" className="nav-link">Decision Board</Link>
              <Link href="/hunts" className="nav-link">Hunts</Link>
              <Link href="/jobs" className="nav-link">Jobs Explorer</Link>
              <Link href="/companies" className="nav-link">Companies</Link>
              <Link href="/profile" className="nav-link">Profile</Link>
              <Link href="/settings" className="nav-link">Settings</Link>
            </nav>
            <div style={{ marginTop: 'auto' }}>
              <Link href="/hunts/new" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
                New Hunt
              </Link>
            </div>
          </aside>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
