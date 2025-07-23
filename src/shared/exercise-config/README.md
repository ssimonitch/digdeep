# Exercise Configuration Module

This module provides centralized configuration for exercise detection across the DigDeep application.

## Directory Structure

```
exercise-config/
├── base/                  # Generic types and utilities
│   ├── types.ts          # Base interfaces (ExerciseConfig, ExerciseDetectionConfig)
│   ├── validation.ts     # Generic validation functions
│   └── index.ts          # Module exports
├── squat/                # Squat-specific configuration
│   ├── types.ts         # Squat interfaces (SquatAnalysisConfig, SquatExerciseConfig)
│   ├── config.ts        # Squat configuration constants
│   ├── validation.ts    # Squat validation functions
│   └── index.ts         # Module exports
└── index.ts             # Main barrel export (maintains backward compatibility)
```

## Usage Examples

### Explicit Module Import (Recommended for new code)

```typescript
// Import only what you need from specific modules
import { SQUAT_EXERCISE_CONFIG } from '@/shared/exercise-config/squat';
import { validateExerciseDetectionConfig } from '@/shared/exercise-config/base';

// Or use namespace imports for clarity
import { base, squat } from '@/shared/exercise-config';

const config = squat.SQUAT_EXERCISE_CONFIG;
const validation = base.validateExerciseDetectionConfig(config);
```

### Future Exercise Support

When adding new exercises (e.g., deadlift), create a new directory:

```
exercise-config/
├── base/
├── squat/
└── deadlift/             # New exercise
    ├── types.ts         # DeadliftAnalysisConfig, DeadliftExerciseConfig
    ├── config.ts        # DEADLIFT_EXERCISE_CONFIG
    ├── validation.ts    # validateDeadliftAnalysisConfig
    └── index.ts
```