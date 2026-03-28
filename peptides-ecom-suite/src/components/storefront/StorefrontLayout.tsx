import { Link } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import StorefrontHeader from './Header';
import StorefrontFooter from './Footer';
import StorefrontJsonLd from './StorefrontJsonLd';

export default function StorefrontLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <StorefrontJsonLd />
      <StorefrontHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <StorefrontFooter />
    </div>
  );
}
