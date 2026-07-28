FROM jenkins/jenkins:lts-jdk21

USER root

COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates curl git gh jq python3 python3-pip sqlite3 procps \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
      libdrm2 libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 \
      libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
      libxkbcommon0 libxrandr2 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/jenkins_home/caches/npm /var/jenkins_home/caches/ms-playwright /var/jenkins_home/caches/qodo \
    && chown -R jenkins:jenkins /var/jenkins_home/caches

USER jenkins
