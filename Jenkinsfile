// Standalone Jenkins CI for the jenkins-demo integration branch. GitHub only
// supplies repository webhooks; CI, Qodo Cover and AI triage run in Jenkins.
pipeline {
  agent any

  tools { nodejs 'node20' }

  parameters {
    choice(name: 'RUN_MODE', choices: ['AUTO', 'CI', 'QODO'], description: 'AUTO handles GitHub PR webhooks; QODO requires PR_NUMBER.')
    string(name: 'PR_NUMBER', defaultValue: '', description: 'Pull request number for a manual Qodo Cover run.')
    booleanParam(name: 'ENABLE_AI_TRIAGE', defaultValue: true,
        description: 'On a failed build, produce a non-blocking NVIDIA NIM triage report.')
  }

  triggers {
    GenericTrigger(
      genericVariables: [
        [key: 'GH_ACTION', value: '$.action', defaultValue: ''],
        [key: 'GH_PR_NUMBER', value: '$.number', defaultValue: ''],
        [key: 'GH_PR_HEAD_REPO', value: '$.pull_request.head.repo.full_name', defaultValue: ''],
        [key: 'GH_PR_BASE_REF', value: '$.pull_request.base.ref', defaultValue: ''],
        [key: 'GH_PR_STATE', value: '$.pull_request.state', defaultValue: ''],
        [key: 'GH_PR_DRAFT', value: '$.pull_request.draft', defaultValue: ''],
        [key: 'GH_REPOSITORY', value: '$.repository.full_name', defaultValue: '']
      ],
      causeString: 'GitHub webhook: $GH_ACTION PR #$GH_PR_NUMBER',
      tokenCredentialId: 'github-webhook-token',
      printContributedVariables: false,
      printPostContent: false,
      silentResponse: false
    )
  }

  options {
    skipDefaultCheckout(true)
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {
    stage('Classify Qodo event') {
      steps {
        script {
          env.QODO_PR = params.PR_NUMBER?.trim() ?: (env.GH_PR_NUMBER ?: '')
          def automaticQodo = env.GH_PR_NUMBER &&
            ['opened', 'reopened', 'synchronize', 'ready_for_review', 'labeled'].contains(env.GH_ACTION) &&
            env.GH_PR_BASE_REF == 'jenkins-demo' && env.GH_PR_STATE == 'open' &&
            env.GH_PR_DRAFT != 'true' && env.GH_PR_HEAD_REPO == env.GH_REPOSITORY
          env.QODO_ELIGIBLE = (params.RUN_MODE == 'QODO' || (params.RUN_MODE == 'AUTO' && automaticQodo)) ? 'true' : 'false'
          echo "Qodo eligible: ${env.QODO_ELIGIBLE}; PR: ${env.QODO_PR ?: 'none'}"
        }
      }
    }

    stage('Checkout') {
      steps { checkout scm }
    }

    // Equivalent to qodo-cover.yml. The script repeats the PR validation so
    // a forged webhook or a manual parameter cannot grant write access to a
    // fork. Qodo itself may only add tests under tests/api/guard.
    stage('Qodo Cover') {
      when { expression { env.QODO_ELIGIBLE == 'true' } }
      options { lock(resource: 'qodo-cover-github-models', inversePrecedence: true) }
      steps {
        script {
          if (!env.QODO_PR) { error('Qodo Cover requires PR_NUMBER.') }
        }
        withCredentials([
          string(credentialsId: 'github-ci-pat', variable: 'GITHUB_TOKEN'),
          string(credentialsId: 'nvidia-nim-api-key', variable: 'NVIDIA_NIM_API_KEY')
        ]) {
          sh '''
              set -eu
              export GH_TOKEN="$GITHUB_TOKEN"
              export QODO_BASE_BRANCH="jenkins-demo"
              export QODO_MODEL="nvidia_nim/nvidia/llama-3.3-nemotron-super-49b-v1.5"
              export QODO_DESIRED_COVERAGE="90"
            repository="$(git config --get remote.origin.url | sed -E 's#^https://github.com/##; s#^git@github.com:##; s#\\.git$##')"
            gh pr checkout "$QODO_PR" --repo "$repository" --force
            npm ci --cache .npm-cache --prefer-offline
            (cd backend && npm ci --cache ../.npm-cache --prefer-offline)
            bash scripts/jenkins-qodo-cover.sh "$QODO_PR"
          '''
        }
      }
    }

    // A Jenkins agent normally retains its workspace while a GitHub-hosted
    // runner does not. Reset the two stateful resources before every build.
    stage('Clean workspace state') {
      steps {
        sh '''
          pkill -f "node backend/server.js" || true
          rm -f backend/test.sqlite
          rm -rf reports coverage .nyc_output
          mkdir -p reports
        '''
      }
    }

    stage('Install root and backend dependencies') {
      steps {
        sh 'npm ci --cache .npm-cache --prefer-offline'
        dir('backend') { sh 'npm ci --cache ../.npm-cache --prefer-offline' }
      }
    }

    // Equivalent to GHA backend-guard: this is the only backend gate that
    // must fail the pipeline. test:coverage already emits guard.xml and
    // cobertura-coverage.xml, so do not run the guard suite a second time.
    stage('Backend Guard and Coverage (must pass)') {
      steps { sh 'npm run test:coverage' }
    }

    stage('Generate coverage badge') {
      steps { sh 'npx --no-install make-coverage-badge' }
    }

    stage('Backend Spec (allowed-fail)') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh 'npm run test:spec'
        }
      }
    }

    // ci.yml currently executes this suite once. Its historical "x10"
    // label is evidence-oriented, but a Jenkins run must not silently change
    // the workflow's executed test count.
    stage('Flaky Test Watch (allowed-fail)') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh 'npm run test:flaky'
        }
      }
    }

    // GitHub Actions runs the matrix cells on independent runners. Run them
    // sequentially here because both apps require one backend on port 3000
    // and the same isolated SQLite path.
    stage('Web Smoke Tests (must pass)') {
      steps {
        script { runPlaywrightSmoke('frontend-web', 'playwright-web.xml') }
      }
    }

    stage('Admin Smoke Tests (must pass)') {
      steps {
        script { runPlaywrightSmoke('frontend-admin', 'playwright-admin.xml') }
      }
    }

    stage('Mobile Smoke Tests (must pass)') {
      steps {
        dir('frontend-mobile') {
          sh 'npm ci --legacy-peer-deps --cache ../.npm-cache --prefer-offline'
          sh 'npm run test:ci'
        }
      }
    }

  }

  post {
    always {
      sh 'pkill -f "node backend/server.js" || true'
      junit allowEmptyResults: true, testResults: 'reports/**/*.xml'
      recordCoverage(tools: [[parser: 'COBERTURA', pattern: 'coverage/cobertura-coverage.xml']])
      archiveArtifacts allowEmptyArchive: true, artifacts: 'reports/**/*.xml,coverage/**'
    }

    success {
      script {
        // Mirrors the badge side effect of ci.yml, but never pushes from a PR
        // build and never makes an otherwise successful build fail.
        if (!env.CHANGE_ID && env.BRANCH_NAME) {
          catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
            withCredentials([string(credentialsId: 'github-api-token', variable: 'GITHUB_TOKEN')]) {
              sh '''
                set +x
                git config user.name "jenkins[bot]"
                git config user.email "jenkins[bot]@users.noreply.github.com"
                git add coverage/badge.svg
                git diff --cached --quiet && exit 0
                git commit -m "chore: update coverage badge [skip ci]"
                remote_url="$(git config --get remote.origin.url)"
                case "$remote_url" in
                  https://github.com/*)
                    authenticated_url="https://x-access-token:${GITHUB_TOKEN}@${remote_url#https://github.com/}"
                    ;;
                  *)
                    echo "Coverage badge was committed locally; origin is not HTTPS GitHub, so it was not pushed."
                    exit 0
                    ;;
                esac
                git push "$authenticated_url" "HEAD:${BRANCH_NAME}"
              '''
            }
          }
        }
      }
    }

    unsuccessful {
      script {
        if (params.ENABLE_AI_TRIAGE) {
          sh 'mkdir -p reports'
          // Do not use currentBuild.rawBuild.getLog(): Multibranch Jenkinsfiles
          // run in the Groovy sandbox and that internal API needs an unsafe
          // administrator approval. JUnit XML is the durable failure evidence
          // emitted by every suite and is safe to read from the workspace.
          sh '''
            {
              echo "Jenkins build ${BUILD_URL:-unknown} finished as ${currentBuildResult:-unsuccessful}"
              find reports -type f -name '*.xml' -print -exec tail -n 300 {} \\;
            } > reports/jenkins-triage-input.log
          '''
          catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
            withCredentials([
              string(credentialsId: 'github-ci-pat', variable: 'GITHUB_TOKEN'),
              string(credentialsId: 'nvidia-nim-api-key', variable: 'NVIDIA_NIM_API_KEY')
            ]) {
              sh '''
                export NVIDIA_NIM_MODEL="nvidia/llama-3.3-nemotron-super-49b-v1.5"
                node scripts/jenkins-ai-triage.js \
                  --log reports/jenkins-triage-input.log \
                  --output reports/ai-triage.md \
                  --repository "$(git config --get remote.origin.url)" \
                  --pr "${QODO_PR:-${CHANGE_ID:-}}"
              '''
            }
          }
        }
      }
      archiveArtifacts allowEmptyArchive: true, artifacts: 'reports/jenkins-triage-input.log,reports/ai-triage.md'
    }
  }
}

def runPlaywrightSmoke(String app, String report) {
  dir(app) {
    sh 'npm ci --legacy-peer-deps --cache ../.npm-cache --prefer-offline'
    // The Jenkins agent image must contain Playwright's OS dependencies once;
    // unlike a hosted GHA runner, an unprivileged Jenkins build cannot use
    // `playwright install --with-deps`.
    sh 'npx playwright install chromium'
  }
  sh '''
    rm -f backend/test.sqlite
    DB_PATH=backend/test.sqlite PORT=3000 nohup node backend/server.js > reports/backend-${BUILD_TAG}.log 2>&1 &
    echo $! > reports/backend.pid
    sleep 2
    kill -0 "$(cat reports/backend.pid)"
  '''
  try {
    dir(app) {
      withEnv(["CI=true", "PLAYWRIGHT_JUNIT_OUTPUT_FILE=../reports/${report}"]) {
        sh 'npx playwright test'
      }
    }
  } finally {
    sh '''
      if [ -f reports/backend.pid ]; then kill "$(cat reports/backend.pid)" 2>/dev/null || true; fi
      pkill -f "node backend/server.js" || true
      rm -f reports/backend.pid
    '''
  }
}
