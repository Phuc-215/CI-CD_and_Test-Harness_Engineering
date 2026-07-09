# [BUG-26][FR-MB] — Unhelpful, generic error message on profile update failure

## Description
Any failure while saving the mobile profile — a real server error, a network failure, a validation rejection — surfaces the exact same static message, "Lỗi cập nhật", to the user. The actual error message/reason returned by the server (if any) is never read or displayed, making it impossible for a user (or a tester) to tell what actually went wrong from the UI alone.

## Environment
- Component: `frontend-mobile` (React Native / Expo)
- Screen: Profile update form
- No physical device/emulator was used to view this visually in this session; confirmed directly from the `catch` block logic in source.

## Location in Codebase
| File | Range Line |
|---|---|
| `frontend-mobile/App.js` | 304, 308 (`throw new Error("Lỗi cập nhật")` on any non-OK response, then `catch` always shows the same static `Alert.alert("Lỗi", "Lỗi cập nhật")`, discarding whatever the server actually returned) |

## Affect Level
**LOW**

## Steps to Reproduce (CLI)
```bash
grep -n "Lỗi cập nhật\|catch (error)" CI-CD_and_Test-Harness_Engineering/frontend-mobile/App.js
# Expected: the catch block reads and displays error.message / the server's actual error response.
# Actual (lines 304, 308): both the thrown error and the displayed Alert use the same hardcoded string,
# regardless of what the server response body actually contained.
```

## Suggested Fix
In `App.js:296-309`, when `!response.ok`, parse the response body (e.g. `const body = await response.json()`) and throw/display `body.error` (falling back to a generic message only if the body has no error field), instead of always showing the same static "Lỗi cập nhật" text.
