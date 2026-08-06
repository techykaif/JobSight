import './globals.css';
import GlobalSearch from '@/components/GlobalSearch';
import Sidebar from '@/components/Sidebar';

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
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
