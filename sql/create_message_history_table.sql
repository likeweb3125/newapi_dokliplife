-- =============================================
-- 문자 발송 이력 테이블
-- =============================================

CREATE TABLE IF NOT EXISTS `messageSmsHistory` (
  `esntlId` VARCHAR(50) NOT NULL COMMENT 'PK (IDS 테이블 messageSmsHistory, prefix MSH)',
  `title` VARCHAR(200) NOT NULL COMMENT '메시지 제목 (발송 이력)',
  `content` TEXT NOT NULL COMMENT '메시지 내용 (발송 이력)',
  `gosiwonEsntlId` VARCHAR(50) NULL COMMENT '고시원 ID (선택)',
  `userEsntlId` VARCHAR(50) NULL COMMENT '수신자 사용자 ID (전화번호로 customer 중 최신 활성 사용자 esntlId)',
  `receiverPhone` VARCHAR(50) NULL COMMENT '수신자 전화번호 (발송 대상)',
  `createdBy` VARCHAR(50) NULL COMMENT '작성 관리자 ID (발송자)',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일(발송 기록 시각)',
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  PRIMARY KEY (`esntlId`),
  INDEX `idx_messageHistory_gosiwon` (`gosiwonEsntlId`),
  INDEX `idx_messageHistory_user` (`userEsntlId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci COMMENT='문자 발송 이력 저장';

-- =============================================
-- 참고
-- =============================================
-- - messageHistory는 발송 이력용으로 제목/내용/수신자/작성자 등을 기록
-- - gosiwonEsntlId로 고시원별 필터 가능
