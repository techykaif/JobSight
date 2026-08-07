import './globals.css';
import GlobalSearch from '@/components/GlobalSearch';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'JobSight — Opportunity Intelligence Platform',
  description: 'Discover hidden career opportunities before anyone else. JobSight is an AI-powered intelligence platform for serious professionals.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <GlobalSearch />
        <div className="app-shell">
          <Sidebar />
          <main className="main-content" id="main-content" role="main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
