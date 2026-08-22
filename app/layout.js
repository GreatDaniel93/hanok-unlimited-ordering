import './globals.css';
import SystemNav from './components/SystemNav';
import LanguageSwitcher from './components/LanguageSwitcher';

export const metadata = {
  title: 'Hanok Unlimited Ordering',
  description: 'Hanok Wagga Wagga table-order unlimited Korean BBQ system',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><SystemNav/><LanguageSwitcher/>{children}</body></html>;
}
