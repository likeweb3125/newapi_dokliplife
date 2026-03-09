-- =============================================
-- messageSmsHistory 테이블 - MMS 첨부 이미지 경로 컬럼 추가
-- =============================================

ALTER TABLE `messageSmsHistory`
  ADD COLUMN `imagePath` VARCHAR(500) NULL COMMENT 'MMS 첨부 이미지 저장 경로 (예: upload/message/xxx.jpg)' AFTER `content`;
