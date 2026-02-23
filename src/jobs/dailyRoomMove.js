/**
 * 일일 방이동 실행 잡
 * - roomMoveStatus에서 moveDate가 당일이고 status가 PENDING인 건을 조회
 * - 각 건에 대해 /v1/roomMove/process 당일 처리와 동일하게 방이동 실행 (계약·roomStatus·room 반영 후 roomMoveStatus를 COMPLETED로 갱신)
 * - 매일 자정 스케줄러에서 호출
 * - 수동 실행: GET /v1/room/daily/roomMove
 */

const roomMoveController = require('../controllers/roomMove');
const { formatDateKST } = require('../middleware/dateJson');

const JOB_NAME = 'DailyRoomMoveJob';

function log(msg, detail = '') {
	const ts = formatDateKST(new Date());
	console.log(`[${JOB_NAME}] ${ts} ${msg}${detail ? ' ' + detail : ''}`);
}

/**
 * 당일 예정된 PENDING 방이동을 실행 (roomMoveStatus moveDate=당일, status=PENDING 건을 /v1/roomMove/process 당일 처리와 동일하게 실행)
 * @returns {Promise<{ total: number, processed: number, failed: number, errors: Array<{ roomMoveStatusId: string, message: string }> }>}
 */
async function run() {
	log('시작');
	const result = await roomMoveController.runDailyRoomMove();
	log('완료', `total=${result.total}, processed=${result.processed}, failed=${result.failed}`);
	return result;
}

module.exports = {
	run,
	JOB_NAME,
};
