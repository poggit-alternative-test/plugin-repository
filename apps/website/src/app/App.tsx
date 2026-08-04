import { AppRouter } from '@/routes';
import { ThemeProvider } from '@/contexts/ThemeContext';

export function App() {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}
