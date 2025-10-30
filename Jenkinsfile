pipeline {
    agent { label 'build-agent' }

    environment {
        REPO_URL   = 'https://github.com/likeweb3125/basic_sobasic_solution_apilution.git'
        APP_DIR    = '//home/likeweb/basic/api.likeweb.co.kr'
        // RECIPIENTS = 'ohsjwe@likeweb.co.kr,shan@likeweb.co.kr,crazin@likeweb.co.kr'
        RECIPIENTS = 'crazin@likeweb.co.kr'
    }

    stages {
        stage('Extract Git Info') {
            steps {
                script {
                    // 브랜치명
                    env.GIT_BRANCH = sh(script: "git rev-parse --abbrev-ref HEAD", returnStdout: true).trim()
                    env.GIT_BRANCHSTRIP = env.GIT_BRANCH
                        .replaceFirst(/^origin\//, '')
                        .replaceFirst(/^refs\\/heads\\//, '')   

                    // 최신 커밋 정보.
                    env.GIT_COMMIT_HASH    = sh(script: "git rev-parse HEAD", returnStdout: true).trim()
                    env.GIT_COMMIT_AUTHOR  = sh(script: "git log -1 --pretty=format:'%an'", returnStdout: true).trim()
                    env.GIT_COMMIT_EMAIL   = sh(script: "git log -1 --pretty=format:'%ae'", returnStdout: true).trim()
                    env.GIT_COMMIT_MESSAGE = sh(script: "git log -1 --pretty=format:'%s'", returnStdout: true).trim()
                    env.GIT_COMMIT_TIME    = sh(script: "git log -1 --pretty=format:'%cd' --date=format:'%Y-%m-%d %H:%M:%S'", returnStdout: true).trim()

                    echo "🔎 브랜치: ${env.GIT_BRANCHSTRIP}"
                    echo "🔎 커밋: ${env.GIT_COMMIT_HASH}"
                    echo "🔎 작성자: ${env.GIT_COMMIT_AUTHOR} <${env.GIT_COMMIT_EMAIL}>"
                    echo "🔎 메시지: ${env.GIT_COMMIT_MESSAGE}"
                    echo "🔎 시간: ${env.GIT_COMMIT_TIME}"
                }
            }
        }

        stage('Rolling Deploy v1 -> v2') {
            steps {
                script {
                    // v1 배포 및 헬스체크
                    deployVersion()
                }
            }
        }
    }

    post {
        success {
            sendMailOnSuccess()
        }
        failure {
            sendMailOnFailure("❌ 파이프라인 실패")
        }
        always {
            echo "🧹 사용하지 않는 Docker 볼륨 정리 중..."
            sh 'docker volume prune -f'
        }
    }
}

// ===== Functions =====

// 배포 함수
def deployVersion() {
    def path = "${env.APP_DIR}"

    echo "🚀 배포 시작"

    sshagent(credentials: ['github-key-likeweb']) {
        sh """
            set -e
            cd ${path}
            git fetch origin
            git reset --hard origin/${env.GIT_BRANCHSTRIP}
            git clean -fd
            git pull origin ${env.GIT_BRANCHSTRIP}

            echo "🛠 .env 파일에서 환경변수 로드 중..."
            export \$(grep -v '^#' .env | sed 's/#.*//' | xargs)

            echo "📦 Docker Compose 실행 중..."
            docker compose -f docker-compose.yml down -v
            docker compose -f docker-compose.yml up -d --build
        """
    }

    echo "✅ 배포 완료"
}

// 헬스체크 대기 함수
def waitForHealthy(version, timeoutSeconds, port) {
    def url = "http://127.0.0.1:${port}/health"

    echo "⏳ ${version} 헬스체크 확인 중 (${url})..."
    timeout(time: timeoutSeconds, unit: 'SECONDS') {
        waitUntil {
            def status = sh(script: "curl -fsS ${url} >/dev/null 2>&1", returnStatus: true)
            if (status == 0) {
                echo "💚 ${version} 정상 기동 확인"
                // 성공했어도 HAProxy가 UP 판정할 시간을 주기 위해 추가 대기
                sleep 30
                return true
            }
            sleep 5
            return false
        }
    }
}


// 실패 시 메일
def sendMailOnFailure(message) {
    emailext (
        subject: "🔴 빌드 실패: ${env.JOB_NAME} #${env.BUILD_NUMBER} (${env.GIT_BRANCHSTRIP})",
        body: """
        <h2>❌ Jenkins 빌드 실패</h2>
        <p>브랜치: ${env.GIT_BRANCHSTRIP}</p>
        <p>에러 메시지: ${message}</p>
        <p><a href="${env.BUILD_URL}console">로그 보기</a></p>
        """,
        to: "${env.RECIPIENTS}",
        from: "no-reply@likeweb.co.kr"
    )
}

// 성공 시 메일
def sendMailOnSuccess() {
    emailext (
        subject: "✅ 빌드 성공: ${env.JOB_NAME} #${env.BUILD_NUMBER} (${env.GIT_BRANCHSTRIP})",
        body: """
        <h2>🎉 Jenkins 빌드 성공 (v1 & v2 롤링 배포)</h2>
        <p>브랜치: ${env.GIT_BRANCHSTRIP}</p>
        <p><a href="${env.BUILD_URL}console">로그 보기</a></p>
        """,
        to: "${env.RECIPIENTS}",
        from: "no-reply@likeweb.co.kr"
    )
}
