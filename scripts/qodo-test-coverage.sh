#!/usr/bin/env bash
set -euo pipefail

# PyInstaller prepends its bundled libraries to LD_LIBRARY_PATH. Restore the
# runner environment before Node loads native modules such as sqlite3.
if [[ -n "${LD_LIBRARY_PATH_ORIG+x}" ]]; then
  export LD_LIBRARY_PATH="$LD_LIBRARY_PATH_ORIG"
else
  unset LD_LIBRARY_PATH
fi

if (( $# == 0 )); then
  set -- tests/api/guard
fi

export DB_PATH=backend/test.sqlite

exec npx --no-install nyc \
  --reporter=html \
  --reporter=json-summary \
  --reporter=cobertura \
  --reporter=text \
  mocha "$@" \
  --reporter mocha-junit-reporter \
  --reporter-options mochaFile=reports/guard.xml \
  --timeout 20000
