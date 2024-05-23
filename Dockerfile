# Alpine Linux 최신 버전을 베이스 이미지로 사용
FROM node:20-alpine

# 필요한 패키지 설치
RUN apk update && apk add --no-cache tzdata cronie vim zsh git curl

# 타임존 설정
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 작업 디렉토리 설정
WORKDIR /app

# 애플리케이션 파일을 이미지로 복사
COPY . .

# oh-my-zsh 설치
RUN sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" || true
RUN sed -i 's|/root:.*|/root:/usr/bin/zsh|' /etc/passwd

# package.json에 정의된 의존성 설치
RUN npm install

# tzdata 패키지 설치 및 시간대 설정
# npm 의존성 설치를 위한 한 단계로 결합하여 Docker 레이어를 최적화
RUN apk add --no-cache tzdata && \
    npm install

# 시스템 환경 변수로 시간대 설정
ENV TZ=Asia/Seoul

# 애플리케이션에서 사용하는 포트 노출
EXPOSE 3003

# 애플리케이션 실행 명령어
CMD ["npx", "nodemon", "app.js"]