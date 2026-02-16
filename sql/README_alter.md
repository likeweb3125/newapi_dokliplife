# 테이블별 수정(ALTER/ADD) SQL 통합 안내

CREATE TABLE 제외한 **테이블 수정(ALTER, ADD COLUMN, CREATE INDEX 등)** 스크립트는 **테이블당 한 개 파일**로 통합해 두었습니다.

## 통합 파일 규칙

- 파일명: **`alter_<테이블명>.sql`**
- 한 테이블에 대한 수정은 해당 파일에만 추가합니다.
- 적용 순서대로 실행하며, 이미 적용된 구간은 주석 처리하거나 건너뜁니다.

## 테이블별 통합 파일 목록

| 테이블 | 파일 |
|--------|------|
| il_room_deposit | alter_il_room_deposit.sql |
| roomContract | alter_roomContract.sql |
| il_room_reservation (gsplus) | alter_il_room_reservation.sql |
| room | alter_room.sql |
| il_room_deposit_history | alter_il_room_deposit_history.sql |
| il_room_refund_request | alter_il_room_refund_request.sql |
| il_gosiwon_config | alter_il_gosiwon_config.sql |
| paymentLog | alter_paymentLog.sql |
| parkStatus | alter_parkStatus.sql |
| extraPayment | alter_extraPayment.sql |
| depositRefund | alter_depositRefund.sql |
| roomStatus | alter_roomStatus.sql |
| refund | alter_refund.sql |
| roomMoveStatus | alter_roomMoveStatus.sql |
| memo | alter_memo.sql |
| history | alter_history.sql |
| gosiwonParking | alter_gosiwonParking.sql |
| gosiwon | alter_gosiwon.sql |
| customer | alter_customer.sql |
| deposit | alter_deposit.sql |
| depositHistory | alter_depositHistory.sql |
| IDS | alter_IDS.sql |
| roomSee | alter_roomSee.sql |
| roomLike | alter_roomLike.sql |
| il_deposit | alter_il_deposit.sql |

## 기존 분산 파일

`add_*.sql`, `alter_*.sql`, `add_sql/*.sql`, `rename_*.sql`, `remove_*.sql`, `optimize_*.sql` 등은 위 통합 파일로 내용을 모았습니다.  
**새 수정이 필요할 때는 위 `alter_<테이블명>.sql` 에만 추가**해 주세요.
