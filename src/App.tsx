import { HomePage } from '@/features/home/components/HomePage';
import { ThemeProvider } from '@/shared/components/layout/ThemeProvider';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="dig-ui-theme">
      <HomePage />
    </ThemeProvider>
  );
}

export default App;
