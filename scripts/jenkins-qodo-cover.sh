#!/usr/bin/env bash
set -euo pipefail

PR_NUMBER="${1:?usage: jenkins-qodo-cover.sh <pr-number>}"
: "${GH_TOKEN:?GH_TOKEN Jenkins credential is required}"
BASE_BRANCH="${QODO_BASE_BRANCH:-jenkins-demo}"

ORIGIN_URL="$(git remote get-url origin)"
REPOSITORY="$(printf '%s' "$ORIGIN_URL" | sed -E 's#^https://github.com/##; s#^git@github.com:##; s#\.git$##')"
WORKSPACE="$(git rev-parse --show-toplevel)"
REPORT_DIR="$WORKSPACE/reports/qodo"
MODIFIED_JSON="$REPORT_DIR/modified-files.json"
ACTION_REF="${QODO_ACTION_REF:-v0.1.16}"
BINARY="${QODO_CACHE_DIR:-$WORKSPACE/.cache/qodo}/cover-agent-pro-${ACTION_REF}"
mkdir -p "$(dirname "$BINARY")" "$REPORT_DIR" coverage reports

export GITHUB_TOKEN="$GH_TOKEN"
export GITHUB_API_KEY="$GH_TOKEN"
export GITHUB_WORKSPACE="$WORKSPACE"

PR_JSON="$(gh pr view "$PR_NUMBER" --repo "$REPOSITORY" --json state,isDraft,headRefName,headRefOid,headRepository,baseRefName,files)"
HEAD_REPOSITORY="$(gh api "repos/${REPOSITORY}/pulls/${PR_NUMBER}" --jq .head.repo.full_name 2>/dev/null || true)"
HEAD_REF="$(node -e 'console.log(JSON.parse(process.argv[1]).headRefName)' "$PR_JSON")"
HEAD_OID="$(node -e 'console.log(JSON.parse(process.argv[1]).headRefOid)' "$PR_JSON")"
CHECKED_OUT_OID="$(git rev-parse HEAD)"

if ! VALIDATION="$(node -e '
  const p=JSON.parse(process.argv[1]);
  const expectedRepository=process.argv[2];
  const checkedOutOid=process.argv[3];
  const headRepository=process.argv[4];
  const checks={
    open: p.state === "OPEN",
    nonDraft: !p.isDraft,
    targetsBaseBranch: p.baseRefName === process.argv[5],
    internal: headRepository.toLowerCase() === expectedRepository.toLowerCase(),
    currentHead: p.headRefOid === checkedOutOid
  };
  const valid=Object.values(checks).every(Boolean);
  console.log(JSON.stringify({checks, expectedRepository, actualRepository:headRepository || null, prHeadOid:p.headRefOid, checkedOutOid}));
  process.exit(valid ? 0 : 2);
' "$PR_JSON" "$REPOSITORY" "$CHECKED_OUT_OID" "$HEAD_REPOSITORY" "$BASE_BRANCH")"; then
  echo "Qodo PR validation: ${VALIDATION}"
  echo "Qodo requires an internal, open, non-draft PR targeting ${BASE_BRANCH}."
  exit 2
fi
echo "Qodo PR validation: ${VALIDATION}"

node -e '
  const fs=require("fs"), path=require("path");
  const p=JSON.parse(process.argv[1]);
  fs.writeFileSync(process.argv[2], JSON.stringify(p.files.map(f=>f.path).filter(p=>p.startsWith("backend/")).map(p=>path.join(process.argv[3],p))));
' "$PR_JSON" "$MODIFIED_JSON" "$WORKSPACE"

if [ "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).length)' "$MODIFIED_JSON")" = 0 ]; then
  echo "No changed backend files; Qodo has nothing to cover."; exit 0
fi

bash scripts/qodo-test-coverage.sh
cp coverage/coverage-summary.json "$REPORT_DIR/coverage-before.json"
if [ ! -x "$BINARY" ]; then
  curl --fail --location --silent --show-error "https://github.com/qodo-ai/qodo-ci/releases/download/${ACTION_REF}/cover-agent-pro" --output "$BINARY"
  chmod +x "$BINARY"
fi

"$BINARY" --mode pr --project-language javascript --project-root "$WORKSPACE" \
  --diff-coverage false --branch "$BASE_BRANCH" --code-coverage-report-path "$WORKSPACE/coverage/cobertura-coverage.xml" \
  --coverage-type cobertura --test-command "bash scripts/qodo-test-coverage.sh" \
  --model "${QODO_MODEL:-github/gpt-4.1}" --max-iterations 3 --desired-coverage "${QODO_DESIRED_COVERAGE:-70}" \
  --run-each-test-separately true --source-folder . --test-folder tests/api/guard \
  --report-dir "$REPORT_DIR" --modified-files-json "$MODIFIED_JSON" \
  --additional-instructions "Follow existing Mocha, Chai and Supertest conventions. Add tests only under tests/api/guard. Never modify production code or call external services."

mapfile -t CHANGED < <(git status --porcelain | sed -E 's/^...//')
TEST_CHANGED=false
for file in "${CHANGED[@]}"; do
  case "$file" in
    tests/api/guard/*) TEST_CHANGED=true ;;
    .cache/*|coverage/*|reports/*|*.sqlite|*.json|*.log|*.xml|*.html|cover_agent_unit_test_runs.db) ;;
    *) echo "Qodo attempted an out-of-scope change: $file"; exit 3 ;;
  esac
done
[ "$TEST_CHANGED" = true ] || { echo "Qodo generated no guard tests."; exit 0; }

bash scripts/qodo-test-coverage.sh
git config user.name "Qodo Cover"
git config user.email "cover-bot@qodo.ai"
BRANCH="qodo-cover-${PR_NUMBER}-${BUILD_NUMBER:-$(date +%s)}"
git switch -c "$BRANCH"
git add tests/api/guard
git commit -m "test: add Qodo coverage tests"
git push "https://x-access-token:${GH_TOKEN}@github.com/${REPOSITORY}.git" "$BRANCH"
PATCH_URL="$(gh pr create --repo "$REPOSITORY" --base "$HEAD_REF" --head "$BRANCH" --title "Qodo Cover update for PR #${PR_NUMBER}" --body "AI-generated guard tests validated by Jenkins build ${BUILD_URL:-unknown}.")"
gh pr comment "$PR_NUMBER" --repo "$REPOSITORY" --body "Qodo Cover generated and validated a patch PR: ${PATCH_URL}"
