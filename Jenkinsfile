// T07 Seminar — Jenkins (TRADITIONAL CI) pipeline.
// Mirrors .github/workflows/ci.yml stage-for-stage for a clean 1-to-1 comparison matrix.
// GHA `continue-on-error: true`  <->  Jenkins catchError(stageResult: 'UNSTABLE').
// GHA `upload-artifact`          <->  Jenkins junit + Coverage plugin.
pipeline {
  agent any

  tools { nodejs 'node20' }        // configure a NodeJS 20 tool named 'node20' in Manage Jenkins > Tools

  environment {
    DB_PATH = 'backend/test.sqlite'  // same isolated DB the GitHub Actions jobs use
  }

  options {
    timestamps()
    timeout(time: 20, unit: 'MINUTES')
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('NPM Install') {
      // Cache parity note: GitHub Actions uses actions/setup-node cache:'npm' keyed on the
      // lockfile hash; Jenkins reuses the mounted jenkins_home ~/.npm plus a local cache dir.
      steps { sh 'npm ci --cache .npm-cache --prefer-offline' }
    }

    stage('Guard (must pass)') {
      steps {
        sh 'npm run test:guard -- --reporter mocha-junit-reporter --reporter-options mochaFile=reports/guard.xml'
      }
    }

    stage('Coverage (Cobertura)') {
      steps {
        sh 'npx cross-env DB_PATH=backend/test.sqlite nyc --reporter=cobertura --reporter=text mocha tests/api/guard --timeout 20000'
      }
    }

    stage('Spec (allowed-fail)') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh 'npm run test:spec'
        }
      }
    }

    stage('Flaky x10 (evidence)') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh '''
            mkdir -p reports/flaky
            for i in $(seq 1 10); do
              echo "===== Flaky run $i ====="
              npm run test:flaky -- --reporter-options mochaFile=reports/flaky/run-$i.xml || true
            done
          '''
        }
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true, testResults: 'reports/**/*.xml'
      // Requires the Coverage plugin. Comment out if not installed.
      recordCoverage(tools: [[parser: 'COBERTURA', pattern: 'coverage/cobertura-coverage.xml']])
    }
  }
}
