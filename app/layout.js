import './globals.css';
import SystemNav from './components/SystemNav';
import LanguageSwitcher from './components/LanguageSwitcher';
import LunchLanguagePatch from './components/LunchLanguagePatch';
import CustomerFeedbackPrompt from './components/CustomerFeedbackPrompt';
import MenuImageProxyPatch from './components/MenuImageProxyPatch';

export const metadata = {
  title: 'Hanok Unlimited Ordering',
  description: 'Hanok Wagga Wagga table-order unlimited Korean BBQ system',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><SystemNav/><LanguageSwitcher/><LunchLanguagePatch/><CustomerFeedbackPrompt/><MenuImageProxyPatch/>{children}</body></html>;
}
