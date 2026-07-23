#!/usr/bin/env bash
set -euo pipefail

# PyInstaller prepends its bundled libraries to LD_LIBRARY_PATH. Restore the
# runner environment before Node loads native modules such as sqlite3.
if [[ -n "${LD_LIBRARY_PATH_ORIG+x}" ]]; then
  export LD_LIBRARY_PATH="$LD_LIBRARY_PATH_ORIG"
else
  unset LD_LIBRARY_PATH
fi

exec npm run test:coverage -- "$@"
