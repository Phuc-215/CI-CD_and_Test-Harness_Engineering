// CI-only Jenkins pipeline. Configure this Jenkinsfile as a Multibranch
// Pipeline (or run it manually) to validate the checked-out revision.
pipeline {
  agent any

  tools { nodejs 'node20' }

  options {
    skipDefaultCheckout(true)
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    // A Jenkins agent can retain files and processes from an earlier build.
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

    stage('Install dependencies') {
      steps {
        sh 'npm ci --cache .npm-cache --prefer-offline'
        dir('backend') { sh 'npm ci --cache ../.npm-cache --prefer-offline' }
      }
    }

    stage('Backend Guard and Coverage') {
      steps { sh 'npm run test:coverage' }
    }

    stage('Backend Spec') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh 'npm run test:spec'
        }
      }
    }

    stage('Flaky Test Watch') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh 'npm run test:flaky'
        }
      }
    }

    // These run sequentially because both browser suites use backend port 3000.
    stage('Web Smoke Tests') {
      steps {
        script { runPlaywrightSmoke('frontend-web', 'playwright-web.xml') }
      }
    }

    stage('Admin Smoke Tests') {
      steps {
        script { runPlaywrightSmoke('frontend-admin', 'playwright-admin.xml') }
      }
    }

    stage('Mobile Smoke Tests') {
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
  }
}

def runPlaywrightSmoke(String app, String report) {
  dir(app) {
    sh 'npm ci --legacy-peer-deps --cache ../.npm-cache --prefer-offline'
    // The Jenkins agent image must provide Playwright's OS dependencies.
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
