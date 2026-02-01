# Sequelize DATE/DATETIME 컬럼과 타임존 (DataTypes.NOW vs DB CURRENT_TIMESTAMP)

## 1. 요약: 왜 UTC(+0)으로 저장되는가

**Sequelize 모델에서 `defaultValue: DataTypes.NOW`를 쓰면, INSERT 시점의 값이 Node.js에서 생성되어 DB로 전달됩니다.**  
이 값은 MySQL/MariaDB 드라이버를 거치면서 **UTC 기준**으로 직렬화되기 때문에, DB에는 **+0(UTC) 시간대**로 저장됩니다.  
따라서 **세션 타임존(`SET time_zone`)을 `Asia/Seoul`로 바꿔도 이 컬럼은 KST로 바뀌지 않습니다.**

---

## 2. 동작 흐름

### 2.1 `defaultValue: DataTypes.NOW`인 경우

```
[Node.js]
  INSERT 시 → Sequelize가 defaultValue 적용
  → JavaScript: new Date() 로 "지금" 시각 생성 (로컬/시스템 시간)

[Sequelize → 드라이버]
  → Date 객체를 SQL/프로토콜로 직렬화
  → MySQL/MariaDB 드라이버는 보통 UTC(ISO 8601 등)로 변환해 전송

[DB]
  → INSERT 문에 이미 "2026-01-30 03:51:44" 같은 값이 포함됨
  → DB는 받은 값을 그대로 저장 (세션 time_zone과 무관)
  → 결과: DB에 UTC(+0) 시각으로 저장됨
```

- **세션에 `SET time_zone = 'Asia/Seoul'`을 해도**  
  INSERT 문에 **앱이 만든 값이 이미 포함**되어 있으므로, DB가 `CURRENT_TIMESTAMP`를 계산하는 일이 없습니다.  
  따라서 **afterConnect / afterPoolAcquire 로 타임존을 맞춰도 이 컬럼은 UTC로 남습니다.**

### 2.2 `defaultValue: sequelize.literal('CURRENT_TIMESTAMP')`인 경우

```
[Node.js]
  INSERT 시 → Sequelize가 해당 컬럼을 "DB 기본값에 맡김"
  → created_at 같은 컬럼을 INSERT 목록에 넣지 않음 (또는 DEFAULT 사용)

[DB]
  → 컬럼 값이 비어 있으므로 DEFAULT 식 실행
  → CURRENT_TIMESTAMP / NOW() 는 "현재 시각"을 **세션 타임존** 기준으로 계산
  → 세션이 Asia/Seoul 이면 → KST로 저장됨
```

- 이때는 **값을 앱이 보내지 않고**, DB가 **세션 타임존 기준**으로 시각을 채우므로,  
  **afterConnect / afterPoolAcquire 에서 `SET time_zone = 'Asia/Seoul'`** 이 중요합니다.

---

## 3. 정리 표

| 구분 | DataTypes.NOW | sequelize.literal('CURRENT_TIMESTAMP') |
|------|----------------|----------------------------------------|
| **값을 누가 만드나** | Node.js (Sequelize) | DB (MySQL/MariaDB) |
| **실제 사용** | `new Date()` 후 드라이버가 직렬화 | INSERT 시 해당 컬럼 생략 → DEFAULT 식 실행 |
| **전송 형태** | 이미 계산된 시각 값(문자열/바이너리) | 값 없음 → DB가 NOW()/CURRENT_TIMESTAMP 계산 |
| **타임존 기준** | 드라이버 기본(보통 UTC) | **DB 세션 time_zone** |
| **SET time_zone 영향** | **없음** (이미 값이 정해져 있음) | **있음** (KST로 저장 가능) |

---

## 4. 이 프로젝트에서의 권장 사항

- **한국 시간(KST)으로 저장하고 싶은 컬럼** (`created_at`, `updated_at` 등)은  
  **모델에서 `defaultValue: DataTypes.NOW` 대신**  
  **`defaultValue: sequelize.literal('CURRENT_TIMESTAMP')`** (및 필요 시 `ON UPDATE CURRENT_TIMESTAMP`) 사용.
- **DB 연결 직후·풀에서 커넥션 획득 시**  
  `SET time_zone = 'Asia/Seoul'` 실행 (afterConnect, afterPoolAcquire 훅 등)으로  
  **세션 타임존을 고정**해 두면, `CURRENT_TIMESTAMP`/`NOW()`가 KST로 동작합니다.

이렇게 하면 “앱이 UTC로 값을 넣는” 경로를 제거하고, “DB가 세션 타임존으로 시각을 채우는” 경로만 사용하게 되어, KST 저장이 확실해집니다.
