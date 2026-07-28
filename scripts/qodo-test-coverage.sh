#!/usr/bin/env bash
set -euo pipefail

# PyInstaller prepends its bundled libraries to LD_LIBRARY_PATH. Restore the
# runner environment before Node loads native modules such as sqlite3.
if [[ -n "${LD_LIBRARY_PATH_ORIG+x}" ]]; then
  export LD_LIBRARY_PATH="$LD_LIBRARY_PATH_ORIG"
else
  unset LD_LIBRARY_PATH
fi

if [[ "$#" -eq 0 ]]; then
  exec npm run test:coverage
fi

# Qodo appends a test file when run_each_test_separately is enabled. Invoke
# Mocha directly so that file replaces, rather than supplements, the default
# tests/api/guard directory embedded in the npm script.
exec ./node_modules/.bin/cross-env DB_PATH=backend/test.sqlite \
  ./node_modules/.bin/nyc \
  --reporter=html \
  --reporter=json-summary \
  --reporter=cobertura \
  --reporter=text \
  ./node_modules/.bin/mocha "$@" \
  --reporter mocha-junit-reporter \
  --reporter-options mochaFile=reports/guard.xml \
  --timeout 20000
