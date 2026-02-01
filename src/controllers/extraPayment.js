const {
	mariaDBSequelize,
	extraPayment,
	roomContract,
	room,
	customer,
	gosiwon,
	history,
	parking,
	parkStatus,
} = require('../models');
const errorHandler = require('../middleware/error');
const { getWriterAdminId } = require('../utils/auth');
const { next: idsNext } = require('../utils/idsNext');
const aligoSMS = require('../module/aligo/sms');

const EXTR_PREFIX = 'EXTR';
const EXTR_PADDING = 10;

// extraPayment ID 생성 함수 (EXTR 접두사 사용, 마지막 키값 확인)
const generateExtraPaymentId = async (transaction) => {
	const idQuery = `
		SELECT CONCAT('EXTR', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 5) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId
		FROM extraPayment
		WHERE esntlId LIKE 'EXTR%'
	`;
	const [idResult] = await mariaDBSequelize.query(idQuery, {
		type: mariaDBSequelize.QueryTypes.SELECT,
		transaction,
	});
	return idResult?.nextId || 'EXTR0000000001';
};

// 공통 토큰 검증 함수
const verifyAdminToken = (req) => {
	const authHeader = req.get('Authorization');
	if (!authHeader) {
		errorHandler.errorThrow(401, '토큰이 없습니다.');
	}

	const token = authHeader.split(' ')[1];
	if (!token) {
		errorHandler.errorThrow(401, '토큰 형식이 올바르지 않습니다.');
	}

	const jwt = require('jsonwebtoken');
	let decodedToken;
	try {
		decodedToken = jwt.decode(token);
	} catch (err) {
		errorHandler.errorThrow(401, '토큰 디코딩에 실패했습니다.');
	}

	if (!decodedToken || (!decodedToken.admin && !decodedToken.partner)) {
		errorHandler.errorThrow(401, '관리자 정보가 없습니다.');
	}
	return decodedToken;
};

// 날짜 비교 함수 (YYYY-MM-DD 형식)
const compareDates = (date1, date2) => {
	const d1 = new Date(date1);
	const d2 = new Date(date2);
	return d1.getTime() - d2.getTime();
};

// 추가결제 링크 문자 발송 (receiver 번호로, messageSmsHistory 저장)
const sendExtraPaymentLinkSMS = async (receiverPhone, extEid, writerAdminId, gosiwonEsntlId, customerEsntlId) => {
	if (!receiverPhone || !String(receiverPhone).trim()) return;
	try {
		const link = `https://doklipuser.likeweb.co.kr/v2?page=extraPay&ext_eid=${extEid}`;
		const title = '[독립생활]추가결제 안내';
		const message = `다음 링크에서 결제해주세요\n${link}`;
		await aligoSMS.send({ receiver: receiverPhone.trim(), title, message });

		const historyEsntlId = await idsNext('messageSmsHistory');
		const firstReceiver = String(receiverPhone).trim().split(',')[0]?.trim() || String(receiverPhone).trim();
		const userRows = await mariaDBSequelize.query(
			`SELECT C.esntlId FROM customer C WHERE C.phone = :receiverPhone LIMIT 1`,
			{ replacements: { receiverPhone: firstReceiver }, type: mariaDBSequelize.QueryTypes.SELECT }
		);
		const resolvedUserEsntlId = Array.isArray(userRows) && userRows.length > 0 ? userRows[0].esntlId : customerEsntlId || null;
		await mariaDBSequelize.query(
			`INSERT INTO messageSmsHistory (esntlId, title, content, gosiwonEsntlId, userEsntlId, receiverPhone, createdBy, createdAt, updatedAt)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			{
				replacements: [historyEsntlId, title, message, gosiwonEsntlId || null, resolvedUserEsntlId, firstReceiver, writerAdminId || null],
				type: mariaDBSequelize.QueryTypes.INSERT,
			}
		);
	} catch (err) {
		console.error('추가결제 링크 문자 발송 실패:', err);
	}
};

// uniqueId 생성 함수 (pDate와 esntlId를 기반으로 생성)
// 형식: YYYYMMDD + esntlId의 숫자 부분(앞의 0 제거)
// 예: pDate="2025-07-21", esntlId="EXTR0000004274" → uniqueId="202507214274"
const generateUniqueId = (pDate, esntlId) => {
	// pDate에서 날짜 추출 (YYYY-MM-DD 형식 → YYYYMMDD)
	let dateStr = '';
	if (pDate) {
		// pDate가 "2025-07-31" 형식이면 "20250731"로 변환
		dateStr = pDate.replace(/-/g, '');
	}

	// esntlId에서 숫자 부분 추출하고 앞의 0 제거 (예: EXTR0000004274 → 4274)
	let esntlIdNumeric = '';
	if (esntlId) {
		const numericPart = esntlId.replace(/\D/g, '');
		// 앞의 0 제거
		esntlIdNumeric = numericPart.replace(/^0+/, '') || '0';
	}

	// uniqueId 생성: 날짜(YYYYMMDD) + 숫자 부분(앞의 0 제거)
	const uniqueId = dateStr && esntlIdNumeric ? `${dateStr}${esntlIdNumeric}` : null;
	return uniqueId;
};

// 추가 결제 요청
exports.roomExtraPayment = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			contractEsntlId,
			extraPayments, // 배열: [{ extraCostName, cost, memo, extendWithPayment, useStartDate?, carInfo?, optionName? }]
			receiverPhone,
			sendDate,
		} = req.body;

		// 필수 필드 검증
		if (!contractEsntlId) {
			errorHandler.errorThrow(400, 'contractEsntlId를 입력해주세요.');
		}
		if (!extraPayments || !Array.isArray(extraPayments) || extraPayments.length === 0) {
			errorHandler.errorThrow(400, 'extraPayments 배열을 입력해주세요.');
		}

		// 계약 정보 조회
		const contractInfo = await mariaDBSequelize.query(
			`
			SELECT 
				RC.*
			FROM roomContract RC
			JOIN room R ON RC.roomEsntlId = R.esntlId
			JOIN customer C ON RC.customerEsntlId = C.esntlId
			WHERE RC.esntlId = ?
			LIMIT 1
		`,
			{
				replacements: [contractEsntlId],
				type: mariaDBSequelize.QueryTypes.SELECT,
				transaction,
			}
		);

		if (!contractInfo || contractInfo.length === 0) {
			errorHandler.errorThrow(404, '계약 정보를 찾을 수 없습니다.');
		}

		const contract = contractInfo[0];

		// 계약기간 확인 (sendDate가 계약기간 안에 있는지)
		if (sendDate) {
			const contractStartDate = contract.startDate;
			const contractEndDate = contract.endDate;

			if (contractStartDate && contractEndDate) {
				// 날짜 형식 변환 (YYYY-MM-DD)
				const sendDateStr = sendDate.split(' ')[0]; // 시간 부분 제거
				const startDateStr = contractStartDate.split(' ')[0];
				const endDateStr = contractEndDate.split(' ')[0];

				if (
					compareDates(sendDateStr, startDateStr) < 0 ||
					compareDates(sendDateStr, endDateStr) > 0
				) {
					errorHandler.errorThrow(
						400,
						'발송일은 계약기간 안에만 입력할 수 있습니다.'
					);
				}
			}
		}

		// 현재 날짜/시간 (YYYY-MM-DD, HH:MM:SS 형식)
		// 시스템 시간대가 Asia/Seoul로 설정되어 있으므로 new Date()는 한국 시간을 반환
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const pDate = `${year}-${month}-${day}`;
		const pTime = `${hours}:${minutes}:${seconds}`;

		// 추가 결제 항목들 저장
		const createdPayments = [];
		let totalAmount = 0;

		for (const payment of extraPayments) {
			const { extraCostName, cost, memo, extendWithPayment, useStartDate, optionInfo, optionName } = payment;

			// 필수 필드 검증
			if (!extraCostName) {
				errorHandler.errorThrow(400, 'extraCostName을 입력해주세요.');
			}
			if (cost === undefined || cost === null) {
				errorHandler.errorThrow(400, 'cost를 입력해주세요.');
			}

			// esntlId 생성
			const esntlId = await generateExtraPaymentId(transaction);

			// uniqueId 생성
			const uniqueId = generateUniqueId(pDate, esntlId);

			// extraPayment 생성
			const extraPaymentRecord = await extraPayment.create(
				{
					esntlId: esntlId,
					contractEsntlId: contractEsntlId,
					gosiwonEsntlId: contract.gosiwonEsntlId,
					roomEsntlId: contract.roomEsntlId,
					customerEsntlId: contract.customerEsntlId || '',
					uniqueId: uniqueId,
					extraCostName: extraCostName,
					memo: memo || null,
					optionInfo: optionInfo || null,
					useStartDate: useStartDate || null,
					optionName: optionName || null,
					extendWithPayment: extendWithPayment ? 1 : 0,
					pDate: pDate,
					pTime: pTime,
					paymentAmount: String(Math.abs(parseInt(cost, 10))),
					pyl_goods_amount: Math.abs(parseInt(cost, 10)),
					imp_uid: '', // 추가 결제 요청 시 PG 결제 전이므로 빈 문자열
					paymentStatus: 'PENDING', // 결제 상태: PENDING(결제대기), COMPLETED(결제완료), CANCELLED(결제취소), FAILED(결제실패)
					paymentType: null, // paymentType은 결제 주체(수단)이므로 추가 결제 요청 시에는 null
					withdrawalStatus: null,
					deleteYN: 'N',
				},
				{ transaction }
			);

			createdPayments.push({
				esntlId: extraPaymentRecord.esntlId,
				extraCostName: extraPaymentRecord.extraCostName,
				cost: parseInt(extraPaymentRecord.paymentAmount, 10),
			});

			totalAmount += Math.abs(parseInt(cost, 10));

			// optionName이 '자동차' 또는 '오토바이'인 경우 주차장 사용 대수 증가 및 parkStatus 업데이트
			if (optionName === '자동차' || optionName === '오토바이') {
				// gosiwonParking 조회
				const parkingInfo = await parking.findOne({
					where: { gosiwonEsntlId: contract.gosiwonEsntlId },
					transaction,
				});

				if (parkingInfo) {
					// 사용 대수 증가
					if (optionName === '자동차') {
						await parking.update(
							{ autoUse: (parkingInfo.autoUse || 0) + 1 },
							{
								where: { esntlId: parkingInfo.esntlId },
								transaction,
							}
						);
					} else if (optionName === '오토바이') {
						await parking.update(
							{ bikeUse: (parkingInfo.bikeUse || 0) + 1 },
							{
								where: { esntlId: parkingInfo.esntlId },
								transaction,
							}
						);
					}

					// parkStatus 생성 (IDS 테이블 parkStatus PKST)
					const parkStatusId = await idsNext('parkStatus', undefined, transaction);
					// optionInfo를 memo에 저장 (차량번호, 차종 등)
					const parkStatusMemo = optionInfo && optionInfo.trim() !== '' ? optionInfo.trim() : null;
					await parkStatus.create(
						{
							esntlId: parkStatusId,
							gosiwonEsntlId: contract.gosiwonEsntlId,
							contractEsntlId: contractEsntlId,
							customerEsntlId: contract.customerEsntlId || null,
							status: 'IN_USE',
							useStartDate: useStartDate || pDate,
							useEndDate: contract.endDate || null,
							memo: parkStatusMemo, // 차량번호, 차종 등 메모 정보 (optionInfo에서 가져옴)
							deleteYN: 'N',
						},
						{ transaction }
					);
				}
			}
		}

		// History 기록 생성
		const historyIdQuery = `
			SELECT CONCAT('HISTORY', LPAD(COALESCE(MAX(CAST(SUBSTRING(esntlId, 8) AS UNSIGNED)), 0) + 1, 10, '0')) AS nextId
			FROM history
		`;
		const [historyIdResult] = await mariaDBSequelize.query(historyIdQuery, {
			type: mariaDBSequelize.QueryTypes.SELECT,
			transaction,
		});
		const historyId = historyIdResult?.nextId || 'HISTORY0000000001';

		const historyContent = `추가 결제 요청: ${extraPayments.length}건, 총액: ${totalAmount.toLocaleString()}원${
			receiverPhone ? `, 수신자: ${receiverPhone}` : ''
		}${sendDate ? `, 발송일: ${sendDate}` : ''}`;

		await history.create(
			{
				esntlId: historyId,
				gosiwonEsntlId: contract.gosiwonEsntlId,
				roomEsntlId: contract.roomEsntlId,
				contractEsntlId: contractEsntlId,
				content: historyContent,
				category: 'EXTRA_PAYMENT',
				priority: 'NORMAL',
				publicRange: 0,
				writerAdminId: writerAdminId,
				writerType: 'ADMIN',
				deleteYN: 'N',
			},
			{ transaction }
		);

		await transaction.commit();

		// 추가결제 링크 SMS 발송 (수신자: body.receiverPhone 또는 계약 고객 연락처)
		const receiverPhoneToUse = receiverPhone || (contract.customerEsntlId ? (await customer.findByPk(contract.customerEsntlId, { attributes: ['phone'] }))?.phone : null);
		if (receiverPhoneToUse && createdPayments.length > 0) {
			const firstExtEid = createdPayments[0].esntlId;
			await sendExtraPaymentLinkSMS(
				receiverPhoneToUse,
				firstExtEid,
				writerAdminId,
				contract.gosiwonEsntlId,
				contract.customerEsntlId || null
			);
		}

		errorHandler.successThrow(res, '추가 결제 요청이 완료되었습니다.', {
			contractEsntlId: contractEsntlId,
			totalAmount: totalAmount,
			paymentCount: createdPayments.length,
			payments: createdPayments,
			historyId: historyId,
		});
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};
