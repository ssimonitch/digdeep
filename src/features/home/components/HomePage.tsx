import { Menu } from 'lucide-react';

import { ModeToggle } from '@/shared/components/layout/ModeToggle';
import { Button } from '@/shared/components/ui/button';

import { StatsCard } from './StatsCard';
import { WorkoutCard } from './WorkoutCard';

export function HomePage() {
  const handleStartSquatSession = () => {
    // TODO: Implement squat session start
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">DigDeep</h1>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4 space-y-6">
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
            className="w-full h-20 text-xl font-bold bg-primary hover:bg-primary/90">
            <div className="text-center">
              <div>START SQUAT SESSION</div>
              <div className="text-sm font-normal opacity-90 mt-1">Continue from Tuesday • Last: ★★★★☆</div>
            </div>
          </Button>

          {/* Quick Actions */}
          <nav className="grid grid-cols-2 gap-3" aria-label="Quick action buttons">
            <Button
              variant="secondary"
              onClick={handleLastWorkout}
              className="px-6 py-3 h-auto bg-card hover:bg-accent border border-border/50 shadow-sm hover:shadow-md transition-all">
              📊 Last Workout
            </Button>
            <Button
              variant="secondary"
              onClick={handleQuickCheck}
              className="px-6 py-3 h-auto bg-card hover:bg-accent border border-border/50 shadow-sm hover:shadow-md transition-all">
              ⚡ Quick Check
            </Button>
          </nav>
        </section>

        {/* Recent Workouts */}
        <section className="space-y-4" aria-label="Recent Workouts">
          <h2 className="text-xl font-semibold">Recent Workouts</h2>
          <ul className="space-y-3 list-none" role="list">
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
          <div className="text-center pt-4">
            <Button variant="ghost">View All History →</Button>
          </div>
        </section>
      </main>
    </div>
  );
}
