import { Menu } from 'lucide-react';
import { useState } from 'react';

import { ActiveAnalysisScreen, MediaPipePOCPage } from '@/features/analysis/components';
import { ModeToggle } from '@/shared/components/layout/ModeToggle';
import { Button } from '@/shared/components/ui/button';

import { StatsCard } from './StatsCard';
import { WorkoutCard } from './WorkoutCard';

type HomeScreenView = 'home' | 'squat-analysis' | 'mediapipe-poc';

export function HomePage() {
  const [currentView, setCurrentView] = useState<HomeScreenView>('home');

  const handleStartSquatSession = () => {
    setCurrentView('squat-analysis');
  };

  const handleLastWorkout = () => {
    // TODO: Implement last workout navigation
  };

  const handleQuickCheck = () => {
    // TODO: Implement quick check
  };

  const sampleWorkouts = [
    {
      title: 'Today - Squat',
      subtitle: '5x5 @ 225lbs',
      rating: 4,
      metrics: [
        { icon: '✓', text: 'Depth', variant: 'success' as const },
        { icon: '⚠️', text: 'Balance', variant: 'warning' as const },
        { icon: '✓', text: 'Path', variant: 'success' as const },
      ],
    },
    {
      title: 'Tuesday - Bench',
      subtitle: '3x8 @ 185lbs',
      rating: 5,
      metrics: [
        { icon: '✓', text: 'Path', variant: 'success' as const },
        { icon: '✓', text: 'Tempo', variant: 'success' as const },
        { icon: '✓', text: 'Stability', variant: 'success' as const },
      ],
    },
    {
      title: 'Monday - Deadlift',
      subtitle: '3x5 @ 315lbs',
      rating: 3,
      metrics: [
        { icon: '⚠️', text: 'Bar Path', variant: 'warning' as const },
        { icon: '✓', text: 'Lockout', variant: 'success' as const },
        { icon: '❌', text: 'Setup', variant: 'error' as const },
      ],
    },
  ];

  // Handle non-home views
  if (currentView === 'squat-analysis') {
    return <ActiveAnalysisScreen onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'mediapipe-poc') {
    return (
      <div className="bg-background min-h-screen">
        <header className="border-border/40 bg-background/80 border-b backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <Button variant="ghost" onClick={() => setCurrentView('home')}>
              ← Back to Home
            </Button>
            <h1 className="text-2xl font-bold">MediaPipe Testing</h1>
            <ModeToggle />
          </div>
        </header>
        <MediaPipePOCPage />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-border/40 bg-background/80 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">DigDeep</h1>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-4">
        {/* Stats Bar */}
        <section className="grid grid-cols-3 gap-4" aria-label="Performance Statistics">
          <StatsCard icon="🔥" value="7" label="Day Streak" iconLabel="Fire emoji" />
          <StatsCard icon="💪" value="5" label="Level" iconLabel="Flexed bicep emoji" />
          <StatsCard icon="📈" value="+12%" label="This Week" iconLabel="Chart increasing emoji" />
        </section>

        {/* Hero Section */}
        <section className="space-y-4" aria-label="Quick Actions">
          <Button
            onClick={handleStartSquatSession}
            size="lg"
            className="bg-primary hover:bg-primary/90 h-20 w-full text-xl font-bold"
          >
            <div className="text-center">
              <div>START SQUAT SESSION</div>
              <div className="mt-1 text-sm font-normal opacity-90">Continue from Tuesday • Last: ★★★★☆</div>
            </div>
          </Button>

          {/* Quick Actions */}
          <nav className="grid grid-cols-2 gap-3" aria-label="Quick action buttons">
            <Button
              variant="secondary"
              onClick={handleLastWorkout}
              className="bg-card hover:bg-accent border-border/50 h-auto border px-6 py-3 shadow-sm transition-all hover:shadow-md"
            >
              📊 Last Workout
            </Button>
            <Button
              variant="secondary"
              onClick={handleQuickCheck}
              className="bg-card hover:bg-accent border-border/50 h-auto border px-6 py-3 shadow-sm transition-all hover:shadow-md"
            >
              ⚡ Quick Check
            </Button>
          </nav>
        </section>

        {/* Developer Section - Temporary for Testing */}
        <section className="space-y-4 border-t pt-4" aria-label="Developer Tools">
          <h2 className="text-muted-foreground text-lg font-semibold">Developer Tools</h2>
          <Button
            variant="outline"
            onClick={() => setCurrentView('mediapipe-poc')}
            className="w-full justify-start text-left"
          >
            🧪 MediaPipe Performance Test
          </Button>
        </section>

        {/* Recent Workouts */}
        <section className="space-y-4" aria-label="Recent Workouts">
          <h2 className="text-xl font-semibold">Recent Workouts</h2>
          <ul className="list-none space-y-3" role="list">
            {sampleWorkouts.map((workout) => (
              <li key={workout.title}>
                <WorkoutCard
                  title={workout.title}
                  subtitle={workout.subtitle}
                  rating={workout.rating}
                  metrics={workout.metrics}
                  onEdit={() => {
                    // TODO: Implement edit functionality
                  }}
                  onViewStats={() => {
                    // TODO: Implement view stats functionality
                  }}
                  onShare={() => {
                    // TODO: Implement share functionality
                  }}
                  onDelete={() => {
                    // TODO: Implement delete functionality
                  }}
                />
              </li>
            ))}
          </ul>

          {/* View All Button */}
          <div className="pt-4 text-center">
            <Button variant="ghost">View All History →</Button>
          </div>
        </section>
      </main>
    </div>
  );
}
