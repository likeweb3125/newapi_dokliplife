-- =============================================
-- roomMoveStatus FK: ON DELETE CASCADE → RESTRICT
-- 계약서(roomContract) 삭제 시 roomMoveStatus가 물리 삭제되지 않도록,
-- roomMoveStatus는 deleteYN='Y' 소프트 삭제만 허용합니다.
-- 기존 DB에 적용 시 실행하세요.
-- =============================================

-- 고시원 삭제 시 roomMoveStatus 물리 삭제 방지
ALTER TABLE `roomMoveStatus` DROP FOREIGN KEY `fk_roomMoveStatus_gosiwon`;
ALTER TABLE `roomMoveStatus`
  ADD CONSTRAINT `fk_roomMoveStatus_gosiwon` FOREIGN KEY (`gosiwonEsntlId`)
  REFERENCES `gosiwon` (`esntlId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 계약 삭제 시 roomMoveStatus 물리 삭제 방지 (계약서 ID는 삭제되면 안 됨)
ALTER TABLE `roomMoveStatus` DROP FOREIGN KEY `fk_roomMoveStatus_contract`;
ALTER TABLE `roomMoveStatus`
  ADD CONSTRAINT `fk_roomMoveStatus_contract` FOREIGN KEY (`contractEsntlId`)
  REFERENCES `roomContract` (`esntlId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 원래 방/이동 방 삭제 시 roomMoveStatus 물리 삭제 방지
ALTER TABLE `roomMoveStatus` DROP FOREIGN KEY `fk_roomMoveStatus_originalRoom`;
ALTER TABLE `roomMoveStatus`
  ADD CONSTRAINT `fk_roomMoveStatus_originalRoom` FOREIGN KEY (`originalRoomEsntlId`)
  REFERENCES `room` (`esntlId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `roomMoveStatus` DROP FOREIGN KEY `fk_roomMoveStatus_targetRoom`;
ALTER TABLE `roomMoveStatus`
  ADD CONSTRAINT `fk_roomMoveStatus_targetRoom` FOREIGN KEY (`targetRoomEsntlId`)
  REFERENCES `room` (`esntlId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- customer FK는 기존 ON DELETE SET NULL 유지 (변경 없음)
