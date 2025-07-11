# Phase 1.2: LandmarkCalculator Utility Extraction Plan

## Current State Analysis

### Mathematical Calculations Currently Implemented

**SquatPoseAnalyzer Service** (`/Users/slim/Projects/dig/src/services/squat-pose-analyzer.service.ts`):
- **Joint Angle Calculations**: Lines 427-475
  - `calculateAngle()` helper function using atan2 method
  - `safeCalculateAngle()` wrapper with null checks and visibility validation
  - Calculates: left/right knee angles, left/right hip angles, average knee angle

- **Midpoint Calculations**: Lines 494-517
  - `calculateBarPosition()` calculates shoulder midpoint for bar tracking
  - Handles x, y, z coordinates with visibility validation

- **Distance/Balance Calculations**: Lines 522-552
  - `calculateBalance()` computes lateral deviation between hip and knee midpoints
  - Uses simple distance calculations for hip width and deviation measurements

- **Depth Calculations**: Lines 557-590
  - `calculateDepth()` uses hip-knee Y-coordinate ratios
  - Calculates depth percentage and achievement detection

**Test Utilities** (`/Users/slim/Projects/dig/src/test/pose-detection/utils/test-utilities.ts`):
- **Complete Mathematical Functions**:
  - `calculateAngleDegrees()`: Dot product method for angle calculation (lines 15-51)
  - `calculateDistance()`: 3D Euclidean distance (lines 59-65)
  - `calculateMidpoint()`: 3D midpoint with visibility handling (lines 73-80)
  - `calculateSlope()`: Rise over run with infinity handling (lines 88-97)
  - `calculateVerticalDeviation()`: Bar path tracking utility (lines 105-113)
  - Validation utilities: `isLandmarkReliable()`, `areLandmarksReliable()`

### Code Duplication Issues Identified

1. **Angle Calculation Duplication**: 
   - SquatPoseAnalyzer uses atan2 method (less robust)
   - Test utilities use dot product method (more mathematically sound)

2. **No Shared Distance Utilities**: 
   - SquatPoseAnalyzer manually calculates distances inline
   - Test utilities have comprehensive distance functions

3. **Midpoint Calculation Inconsistency**:
   - SquatPoseAnalyzer has basic midpoint calculation
   - Test utilities have more robust version with visibility handling

### Performance Considerations Found

**From Performance Examples** (`/Users/slim/Projects/dig/src/test/pose-detection/performance/performance-examples.ts`):
- Individual calculations must be extremely fast:
  - Distance: < 0.1ms
  - Angle: < 0.5ms  
  - Midpoint: < 0.1ms
- Complete analysis pipeline: < 33ms for 30 FPS requirement
- Extensive benchmarking infrastructure already exists

## Implementation Plan

### Step 1: Create LandmarkCalculator Utility
**Location**: `/Users/slim/Projects/dig/src/shared/utils/landmark-calculator.util.ts`

**Functions to Extract**:
1. **Core Mathematical Functions** (from test-utilities.ts):
   - `calculateAngleDegrees()` - Use dot product method (more robust)
   - `calculateDistance()` - 3D Euclidean distance
   - `calculateMidpoint()` - With visibility handling
   - `calculateSlope()` - For line analysis

2. **Specialized Pose Analysis Functions** (new):
   - `calculateJointAngle()` - Wrapper for pose-specific angle calculation
   - `calculateLateralDeviation()` - Extract from balance calculation
   - `calculateVerticalDeviation()` - Move from test utilities
   - `calculateDepthRatio()` - Extract from depth calculation

3. **Validation Functions**:
   - `isLandmarkReliable()` - Move from test utilities
   - `areLandmarksReliable()` - Move from test utilities
   - `validateLandmarkTriad()` - New function for angle calculations

### Step 2: Update SquatPoseAnalyzer Service
**File**: `/Users/slim/Projects/dig/src/services/squat-pose-analyzer.service.ts`

**Changes**:
1. Replace inline calculations with LandmarkCalculator imports
2. Remove duplicate mathematical functions
3. Update to use more robust angle calculation method
4. Simplify calculation methods to focus on squat-specific logic

### Step 3: Update Test Utilities
**File**: `/Users/slim/Projects/dig/src/test/pose-detection/utils/test-utilities.ts`

**Changes**:
1. Re-export functions from LandmarkCalculator
2. Keep test-specific helper functions
3. Update imports to use shared utility

### Step 4: Performance Validation
**Tasks**:
1. Run existing performance benchmarks to ensure no regression
2. Update performance examples to use new utility
3. Validate 30 FPS requirement is still met

### Step 5: Update Type Exports
**Files**: 
- `/Users/slim/Projects/dig/src/shared/utils/index.ts`
- `/Users/slim/Projects/dig/src/test/pose-detection/utils/index.ts`

## Phase 1.2 Checkboxes

### Current Checkbox: Write tests for angle calculations (knee, hip, ankle angles)

**Status**: Ready to implement
**Files to create/modify**:
- `/Users/slim/Projects/dig/src/shared/utils/__tests__/landmark-calculator.test.ts`
- Test data for knee, hip, and ankle angle calculations
- Edge cases: invalid landmarks, visibility issues, extreme angles

## Benefits of This Approach

1. **Eliminates Code Duplication**: Single source of truth for mathematical calculations
2. **Improves Accuracy**: Uses more robust dot product method for angles
3. **Enhances Performance**: Optimized, well-tested calculations
4. **Better Maintainability**: Changes to calculations only need to be made in one place
5. **Improved Testing**: Comprehensive test coverage already exists
6. **Type Safety**: Strong TypeScript typing throughout

## Files to be Modified

1. **New File**: `/Users/slim/Projects/dig/src/shared/utils/landmark-calculator.util.ts`
2. **Modified**: `/Users/slim/Projects/dig/src/services/squat-pose-analyzer.service.ts`
3. **Modified**: `/Users/slim/Projects/dig/src/test/pose-detection/utils/test-utilities.ts`
4. **Modified**: `/Users/slim/Projects/dig/src/shared/utils/index.ts`
5. **Modified**: `/Users/slim/Projects/dig/src/test/pose-detection/utils/index.ts`

## Risk Mitigation

1. **Performance**: Extensive benchmarking infrastructure exists to validate no regression
2. **Accuracy**: Moving to more mathematically robust calculations
3. **Compatibility**: All existing function signatures will be preserved
4. **Testing**: Comprehensive test suite already covers all mathematical functions

This extraction will significantly improve code organization while maintaining the high-performance requirements for real-time pose analysis.