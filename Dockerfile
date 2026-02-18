# Node 20 LTS 기반
FROM node:20-alpine

# 필요한 패키지 설치
RUN apk update && apk add --no-cache tzdata cronie vim zsh git curl

# 타임존 설정
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 캐시 최적화: package 파일만 우선 복사
COPY package*.json ./

# npm 설정 및 의존성 설치 (네트워크 불안정 대비)
RUN npm config set registry https://registry.npmjs.org && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm ci --no-audit --prefer-offline

# 애플리케이션 파일 복사
COPY . .

# oh-my-zsh 설치 (선택적, 실패 허용)
RUN sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" || true
RUN sed -i 's|/root:.*|/root:/usr/bin/zsh|' /etc/passwd

# 시스템 환경 변수로 시간대 설정
ENV TZ=Asia/Seoul

# 애플리케이션에서 사용하는 포트 노출
EXPOSE 3003

# 애플리케이션 실행 명령어
CMD ["npx", "nodemon", "app.js"]