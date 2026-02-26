# Temporary Alert Accessibility Test Page

## Purpose
Manual testing page for NVDA screen reader compatibility with alert titles.
**Remove this page after validation is complete.**

## Files Added (DELETE these files)
1. `/user-interface/src/test-pages/AlertAccessibilityTest.tsx`
2. `/user-interface/src/test-pages/AlertAccessibilityTest.scss`
3. `/user-interface/src/test-pages/README.md` (this file)

## Files Modified (REVERT these changes)

### `/user-interface/src/App.tsx`
**Line 24:** Remove import
```tsx
import { AlertAccessibilityTest } from './test-pages/AlertAccessibilityTest';
```

**Line 62:** Remove route
```tsx
<Route path="/test/alert-accessibility" element={<AlertAccessibilityTest />}></Route>
```

## To Remove Test Page After Validation

### Option 1: Quick Cleanup
```bash
# Delete entire test-pages directory
rm -rf user-interface/src/test-pages/

# Revert App.tsx changes
git diff user-interface/src/App.tsx  # Review changes
git checkout user-interface/src/App.tsx  # If only test page changes exist
# OR manually remove the import and route lines
```

### Option 2: Manual Cleanup
1. Delete `user-interface/src/test-pages/` directory
2. Open `user-interface/src/App.tsx`
3. Remove the import on line 24
4. Remove the route on line 62

## Permanent Changes (KEEP these)
These changes to Alert.tsx should remain after test page removal:
- `/user-interface/src/lib/components/uswds/Alert.tsx` - accessibility improvements
- `/user-interface/src/lib/components/uswds/Alert.test.tsx` - new accessibility tests
