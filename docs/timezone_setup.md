# 한국 시간(KST) 전체 적용 가이드

**SQL을 일일이 수정하지 않고** 프로젝트 전체에서 `NOW()`, `CURRENT_TIMESTAMP`, 테이블 `DEFAULT CURRENT_TIMESTAMP`가 한국 시간으로 동작하게 하려면 **DB 서버에서 한 번만 설정**하면 됩니다.

---

## 1. DB 서버 설정 (권장, 한 번에 전체 적용)

MariaDB/MySQL **서버**의 기본 타임존을 `Asia/Seoul`로 두면, 해당 DB에 접속하는 **모든 클라이언트**(Node 앱, MySQL 클라이언트, 다른 서비스)가 기본적으로 한국 시간 세션을 사용합니다.

- `NOW()`, `CURRENT_TIMESTAMP` → 한국 시간
- 테이블의 `DEFAULT CURRENT_TIMESTAMP` → 한국 시간
- **앱 코드/SQL 수정 불필요**

### 1-1. my.cnf 설정

MariaDB 설정 파일(`my.cnf` 또는 `mariadb.conf.d/*.cnf`)의 `[mysqld]` 섹션에 추가:

```ini
[mysqld]
default-time-zone='Asia/Seoul'
```

또는 오프셋만 쓸 경우:

```ini
[mysqld]
default-time-zone='+09:00'
```

설정 후 **MariaDB 재시작** 필요.

### 1-2. Docker로 MariaDB 사용 시

- **설정 파일 마운트**

  `my.cnf` 내용을 담은 파일을 만들어 두고, 예를 들어:

  ```yaml
  # docker-compose 예시 (MariaDB 서비스가 있는 경우)
  mariadb:
    image: mariadb:latest
    volumes:
      - ./docker/mariadb-my.cnf:/etc/mysql/conf.d/99-timezone.cnf
    # ...
  ```

  `docker/mariadb-my.cnf`:

  ```ini
  [mysqld]
  default-time-zone='Asia/Seoul'
  ```

- **커맨드로 지정**

  ```yaml
  mariadb:
    image: mariadb:latest
    command: --default-time-zone=Asia/Seoul
    # ...
  ```

DB 서버를 이렇게 설정해 두면, **앱의 모든 SQL은 그대로 두고** 타임존만 한 번에 KST로 통일할 수 있습니다.

---

## 2. 앱(Sequelize) 연결 설정 (보조)

이미 `src/config/config.js`에 다음이 들어가 있습니다.

- `timezone: '+09:00'`  
  → Sequelize가 날짜를 읽을 때 해석하는 타임존.
- `dialectOptions.initSql: "SET time_zone = 'Asia/Seoul'"`  
  → MariaDB 드라이버가 **연결 생성 시** 실행하는 SQL.  
  → 이 연결로 실행되는 `NOW()`, `CURRENT_TIMESTAMP`는 이론상 KST.

다만 **풀/드라이버 동작**에 따라 세션 타임존이 적용되지 않는 경우가 있어, messageSmsHistory 등 일부는 `DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR)`로 보정해 두었습니다.

**가장 안정적인 방법은 1번(DB 서버 default-time-zone)을 적용하고**, 앱 설정은 보조로 두는 것입니다.

---

## 3. 정리

| 방법 | 적용 범위 | SQL 수정 |
|------|------------|----------|
| **DB 서버 `default-time-zone='Asia/Seoul'`** | 해당 DB의 모든 연결·모든 쿼리 | 불필요 |
| 앱 `initSql` + `timezone` | 해당 앱의 Sequelize 연결 | 대부분 불필요(동작 시) |
| SQL에 `DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR)` | 해당 쿼리만 | 필요 |

**권장:** MariaDB 서버(또는 컨테이너)에 `default-time-zone='Asia/Seoul'` 설정 후 재시작하면, 프로젝트 전체를 한 번에 한국 시간으로 쓸 수 있고, SQL을 모두 수정할 필요는 없습니다.
