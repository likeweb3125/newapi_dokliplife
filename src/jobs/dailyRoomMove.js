/**
 * 일일 방이동 실행 잡
 * - (1) 어제 이동 예정이었는데 extraPayment(방이동)가 COMPLETED가 아닌 건은 DELETE /v1/roomMove/:id 와 동일하게 취소
 * - (2) roomMoveStatus에서 moveDate가 당일이고 status가 PENDING인 건을 조회하여 당일 방이동 실행
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
 * (1) 어제 이동 예정 + 방이동 추가결제 미완료 건 취소 후 (2) 당일 PENDING 방이동 실행
 * @returns {Promise<{ cancelResult: object, dailyResult: object }>}
 */
async function run() {
	log('시작');

	// 어제 이동 예정이었으나 extraPayment(방이동)가 COMPLETED가 아닌 건 → 방이동 취소(원상복구)
	const cancelResult = await roomMoveController.runCancelUnpaidYesterdayRoomMoves();
	if (cancelResult.cancelled > 0 || cancelResult.errors.length > 0) {
		log('어제 예정 미결제 방이동 취소', `cancelled=${cancelResult.cancelled}, errors=${cancelResult.errors.length}`);
	}

	const dailyResult = await roomMoveController.runDailyRoomMove();
	log('완료', `total=${dailyResult.total}, processed=${dailyResult.processed}, failed=${dailyResult.failed}`);

	return { cancelResult, dailyResult };
}

module.exports = {
	run,
	JOB_NAME,
};
