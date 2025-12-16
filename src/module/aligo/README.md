# Aligo API 모듈 배치 가이드

## 파일 배치 구조

받으신 aligo API 파일들을 다음과 같이 배치해주세요:

```
src/module/aligo/
├── sms.js              # dist/index_sms.js 또는 dist/index.js (SMS용)
├── alimtalk.js         # dist/index_kakao.js (Alimtalk용)
└── examples/           # 참고용 예제 파일들 (선택사항)
    ├── aligo_sms.js
    └── aligo_kakao.js
```

## 배치 방법

### 1. SMS용 파일
- 받으신 파일 중 `dist/index_sms.js` 또는 `dist/index.js` (SMS용)를
- `src/module/aligo/sms.js`로 복사

### 2. Alimtalk용 파일
- 받으신 파일 중 `dist/index_kakao.js`를
- `src/module/aligo/alimtalk.js`로 복사

### 3. 예제 파일 (선택사항)
- `examples/aligo_sms.js`와 `examples/aligo_kakao.js`를
- `src/module/aligo/examples/` 폴더에 복사 (참고용)

## 사용 방법

### SMS 전송
```javascript
const aligoSMS = require('../module/aligo/sms');

// SMS 전송 예제
await aligoSMS.send({
  receiver: '01012345678',
  message: '전송할 메시지'
});
```

### Alimtalk 전송
```javascript
const aligoAlimtalk = require('../module/aligo/alimtalk');

// Alimtalk 전송 예제
await aligoAlimtalk.send({
  templateId: 'AL_U_PAYMENT_REQUEST_NEW',
  receiver: '01012345678',
  // 기타 필요한 파라미터
});
```

## 환경 변수 설정

`.env` 파일에 aligo API 인증 정보를 추가해야 합니다:
```
ALIGO_API_KEY=your_api_key
ALIGO_USER_ID=your_user_id
ALIGO_SENDER_KEY=your_sender_key  # Alimtalk용
```

## 다음 단계

1. 파일 배치 완료 후
2. `src/controllers/room.js`의 알림톡 발송 로직을 활성화
3. 환경 변수 설정 확인
4. 테스트 진행
