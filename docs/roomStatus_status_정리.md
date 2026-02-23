# roomStatus.status 입력(INSERT/UPDATE) 정리

roomStatus 테이블의 **status** 값을 설정하는 모든 위치를 파일·API·상황별로 정리한 문서입니다.

## 공통 규칙: 미종료 상태 종료 처리

**roomStatus INSERT 직전**에 해당 방에 아직 종료기간이 남아있는 상태(statusEndDate가 NULL이거나 신규 시작일보다 큰 레코드)가 있으면, 그 레코드들의 **statusEndDate를 신규 입력되는 statusStartDate로 업데이트**하여 기간을 종료한 뒤, 새로운 상태를 INSERT한다.

- **유틸 함수:** `src/utils/roomStatusHelper.js` → `closeOpenStatusesForRoom(roomEsntlId, newStatusStartDate, transaction)`
- **호출 위치:** room.js, refund.js, roomMove.js의 모든 roomStatus INSERT 직전

---

## 1. room.js (방 관련)

| API/함수 | 작업 | status 값 | 상황 요약 |
|:---------|:-----|:----------|:----------|
| **roomReserve** (POST `/v1/room/reserve`) | INSERT | `RESERVE_PENDING` | 방 예약·결제 요청 시. reservationEsntlId, statusStartDate(입실예정일), statusEndDate(계약종료일) 저장. |
| **startRoomSell** (POST `/v1/room/roomSell/start`) | UPDATE | `ON_SALE` | 기존 ON_SALE이 있을 때: 판매 기간(statusStartDate, statusEndDate, etc)만 갱신. status는 그대로 ON_SALE. |
| **startRoomSell** | UPDATE | (유지) | CAN_CHECKIN이 있을 때: 기간만 갱신. status는 변경 없음. |
| **startRoomSell** | INSERT | `ON_SALE` | roomStatus가 아무 것도 없을 때: ON_SALE + CAN_CHECKIN 신규 생성. |
| **startRoomSell** | INSERT | `CAN_CHECKIN` | 위와 동일 타이밍. ON_SALE 생성 직후 같은 방에 CAN_CHECKIN 생성. |
| **startRoomSell** | INSERT | `CAN_CHECKIN` | 기존 ON_SALE만 있고 CAN_CHECKIN이 없을 때: CAN_CHECKIN만 신규 생성. |
| **addEventDirectly** (POST `/v1/room/addEventDirectly`) | INSERT | `ETC` 또는 `BEFORE_SALES` | 요청 body의 status. 룸투어·입실 불가 기간 등 이벤트 직접 입력. ETC일 때 statusMemo 필수. |
| **cancelSales** (POST `/v1/room/roomSell/end`) | - | - | 방 ID만 입력(콤마 구분 복수). 각 방의 ON_SALE roomStatus를 조회해 statusEndDate를 salesEndDate로 수정 후 ETC 추가, room.status=EMPTY. (고시원 ID·roomStatusEsntlId 미사용) |
| **cancelSales** | UPDATE | (유지) | 해당 방 ON_SALE 1건의 **statusEndDate**만 salesEndDate로 수정. |
| **cancelSales** | INSERT | `ETC` | setInfinity=true: "무기한 판매중지", 오늘~9999-12-31. |
| **cancelSales** | INSERT | `ETC` | setInfinity=false: statusMemo = unableCheckinReason + " : " + unableCheckinReasonDetail, 기간 = unableCheckinStartDate~unableCheckinEndDate. |

---

## 2. refund.js (환불·퇴실 확정)

| API/함수 | 작업 | status 값 | 상황 요약 |
|:---------|:-----|:----------|:----------|
| **createRoomStatusAfterRefund** (내부) | INSERT | `ON_SALE` | 환불 후 방 상태 재생성 시, 판매 가능 기간(sell_able_start_date ~ sell_able_end_date)으로 ON_SALE 생성. |
| **createRoomStatusAfterRefund** | INSERT | `CAN_CHECKIN` | 위와 동일 플로우. 입실 가능 기간(can_checkin)으로 CAN_CHECKIN 생성. |
| **createRoomStatusAfterRefund** (check_basic_sell=true) | INSERT | `CAN_CHECKIN` | il_gosiwon_config 기준 기간으로 CAN_CHECKIN만 생성. |
| **createRoomStatusAfterRefund** (check_basic_sell=true) | INSERT | `ON_SALE` | 이어서 ON_SALE 생성. |
| **createRoomStatusAfterRefund** (check_basic_sell=false, unableCheckInReason 있음) | INSERT | `BEFORE_SALES` | 입실 불가 사유 있을 때. subStatus에 사유, 기간 9999-12-31까지. |
| **createRoomStatusAfterRefund** (check_basic_sell=false, unableCheckInReason 없음) | (없음) | - | ON_SALE/CAN_CHECKIN 생성 안 함. |
| **퇴실 확정 처리** (환불 확정 시) | UPDATE | `CHECKOUT_CONFIRMED` | contractEsntlId 기준 roomStatus 1건을 CHECKOUT_CONFIRMED로 변경, statusEndDate=CURDATE(). |

---

## 3. roomMove.js (방이동)

| API/함수 | 작업 | status 값 | 상황 요약 |
|:---------|:-----|:----------|:----------|
| **방이동 실행** | UPDATE | (유지) | 원래 방 roomStatus: **subStatus**만 ROOM_MOVE_OUT, statusEndDate=이동일. status는 CONTRACT 유지. |
| **방이동 실행** | INSERT | `CONTRACT` | 이동할(타겟) 방에 새 roomStatus. subStatus=ROOM_MOVE_IN, contractEsntlId=새 계약서. |
| **방이동 실행** | UPDATE | (유지) | 타겟 방 기존 ON_SALE: statusEndDate=이동일, subStatus=END. status는 ON_SALE 유지. |
| **방이동 취소(복구)** | UPDATE | (유지) | 원래 방 roomStatus: subStatus NULL, statusEndDate·contractEsntlId 복구. status는 CONTRACT 유지. |
| **방이동 취소** | DELETE | - | 타겟 방의 CONTRACT+ROOM_MOVE_IN roomStatus 삭제. |
| **방이동 취소** | UPDATE | (유지) | 타겟 방 ON_SALE: subStatus·statusEndDate 복구(END 해제). status는 ON_SALE 유지. |
| **방이동 실행 후 나간 방 상태** | INSERT | `BEFORE_SALES` | roomAfterUse로 상태를 만들지 않은 경우, 나간 방에 무기한(9999-12-31) BEFORE_SALES 1건 INSERT. |

---

## 4. status 값별 요약

| status | INSERT 하는 곳 | UPDATE 하는 곳 | 비고 |
|:-------|:----------------|:----------------|:-----|
| **RESERVE_PENDING** | room.js (roomReserve) | - | 예약금 입금 대기. |
| **ON_SALE** | room.js (startRoomSell), refund.js (createRoomStatusAfterRefund) | room.js (startRoomSell, 기간만) | 판매 중. |
| **CAN_CHECKIN** | room.js (startRoomSell), refund.js (createRoomStatusAfterRefund) | room.js (startRoomSell, 기간만) | 입실 가능 기간. |
| **ETC** | room.js (addEventDirectly, cancelSales) | - | 기타(메모 필수) / 판매중지 등. |
| **BEFORE_SALES** | room.js (addEventDirectly), refund.js, roomMove.js | - | 판매 신청 전 / 입실 불가 사유. |
| **CONTRACT** | roomMove.js (방이동 시 타겟 방) | - | subStatus ROOM_MOVE_IN. |
| **CHECKOUT_CONFIRMED** | - | refund.js (퇴실 확정 시) | contractEsntlId 기준 1건. |

---

## 5. room 테이블과의 연동

- **startRoomSell**: 해당 방 `room.status` → `OPEN` (날짜 미변경).
- **cancelSales** (roomSell/end): 해당 방 `room.status` → `EMPTY` (날짜 미변경).
- **addEventDirectly**: `setRoomEmpty=true` 시 `room.status=EMPTY`, startDate/endDate NULL.
- **roomMove**: 타겟 방 room.status=CONTRACT, 원래 방은 EMPTY/LEAVE 등.
- **refund 퇴실 확정**: 해당 방 room.status=EMPTY, startDate/endDate/customerEsntlId NULL.

---

*문서 생성일: 코드베이스 기준 roomStatus.status를 설정하는 모든 INSERT/UPDATE 위치를 반영.*
