import { HomePage } from '@/components/pages/home-page';
import { ThemeProvider } from '@/components/ui/custom/theme-provider';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="dig-ui-theme">
      <HomePage />
    </ThemeProvider>
  );
}

export default App;
