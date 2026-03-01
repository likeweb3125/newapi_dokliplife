const { mariaDBSequelize } = require('../models');
const errorHandler = require('../middleware/error');
const jwt = require('jsonwebtoken');
const { getWriterAdminId } = require('../utils/auth');

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

/**
 * 가입 관리 목록 조회 (gosiwonAccept.selectList)
 * 입력: page, startDate, endDate, status, searchString (변경 없음)
 * 리턴: 기존 필드 + gosiwon 테이블 추가 컬럼 (use_deposit, use_sale_commision, saleCommisionStartDate, saleCommisionEndDate, saleCommision, use_settlement, settlementReason, is_controlled, is_favorite, penaltyRate, penaltyMin, useDoklipPenaltyRule 등)
 */
exports.getAcceptList = async (req, res, next) => {
	try {
		verifyAdminToken(req);

		const {
			page = 1,
			startDate,
			endDate,
			status,
			searchString,
			limit = 50,
		} = req.query;

		const pageNum = parseInt(page, 10) || 1;
		const limitNum = parseInt(limit, 10) || 50;
		const offset = (pageNum - 1) * limitNum;

		const conditions = ['1=1'];
		const values = [];
		const countValues = [];

		if (status === 'ALL') {
			conditions.push('G.status IS NOT NULL');
		} else if (status) {
			conditions.push('G.status = ?');
			values.push(status);
			countValues.push(status);
		}

		if (searchString && String(searchString).trim()) {
			const searchPattern = `%${String(searchString).trim()}%`;
			conditions.push('(G.name LIKE ? OR G.address LIKE ?)');
			values.push(searchPattern, searchPattern);
			countValues.push(searchPattern, searchPattern);
		}

		if (startDate && endDate) {
			conditions.push('G.acceptDate BETWEEN ? AND ?');
			values.push(startDate, endDate);
			countValues.push(startDate, endDate);
		}

		const whereClause = conditions.join(' AND ');

		// il_gosiwon_file: 3개 JOIN 대신 1개 서브쿼리 피벗으로 최적화 (테이블 스캔 1회)
		const mainQuery = `
			SELECT G.esntlId
				 , G.acceptDate
				 , G.name
				 , G.status
				 , G.corpNumber
				 , G.address
				 , G.address2
				 , G.address3
				 , G.latitude
				 , G.longitude
				 , G.rejectText
				 , G.commision
				 , G.gsw_grade
				 , G.email
				 , G.bank
				 , G.bankAccount
				 , G.accountHolder
				 , GA.hp
				 , GA.ceo
				 , GA.id
				 , G.contractFile
				 , G.contractFileOrgName
				 , G.terminate_reason
				 , G.terminate_date
				 , GFI.certificate_name
				 , GFI.certificate_file
				 , GFI.bankbook_name
				 , GFI.bankbook_file
				 , GFI.stamp_name
				 , GFI.stamp_file
				 , G.use_deposit
				 , G.use_sale_commision
				 , G.saleCommisionStartDate
				 , G.saleCommisionEndDate
				 , G.saleCommision
				 , G.use_settlement
				 , G.settlementReason
				 , G.is_controlled
				 , G.is_favorite
				 , G.penaltyRate
				 , G.penaltyMin
				 , G.useDoklipPenaltyRule
				 , G.numOfRooms
				 , G.keeperName
				 , G.keeperHp
				 , G.phone
				 , G.process
				 , G.serviceNumber
				 , G.gsw_successor_eid
				 , G.update_dtm
			  FROM gosiwon AS G
				   LEFT OUTER JOIN gosiwonAdmin AS GA ON G.adminEsntlId = GA.esntlId
				   LEFT OUTER JOIN (
					   SELECT gsw_eid
							, MAX(CASE WHEN gfi_type = 'certificate' THEN gfi_originname END) AS certificate_name
							, MAX(CASE WHEN gfi_type = 'certificate' THEN gfi_filename END) AS certificate_file
							, MAX(CASE WHEN gfi_type = 'bankbook' THEN gfi_originname END) AS bankbook_name
							, MAX(CASE WHEN gfi_type = 'bankbook' THEN gfi_filename END) AS bankbook_file
							, MAX(CASE WHEN gfi_type = 'stamp' THEN gfi_originname END) AS stamp_name
							, MAX(CASE WHEN gfi_type = 'stamp' THEN gfi_filename END) AS stamp_file
					   FROM il_gosiwon_file
					   WHERE gfi_type IN ('certificate', 'bankbook', 'stamp')
					   GROUP BY gsw_eid
				   ) GFI ON G.esntlId = GFI.gsw_eid
			 WHERE ${whereClause}
			 ORDER BY G.acceptDate DESC, G.esntlId DESC
			 LIMIT ? OFFSET ?
		`;

		const countQuery = `
			SELECT COUNT(*) AS totcnt
			FROM gosiwon G
			WHERE ${whereClause}
		`;

		const mainParams = [...values, limitNum, offset];
		const [resultList, countResult] = await Promise.all([
			mariaDBSequelize.query(mainQuery, {
				replacements: mainParams,
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
			mariaDBSequelize.query(countQuery, {
				replacements: countValues,
				type: mariaDBSequelize.QueryTypes.SELECT,
			}),
		]);

		const totcnt = countResult[0]?.totcnt ?? 0;

		return errorHandler.successThrow(res, '가입 관리 목록 조회 성공', {
			resultList: Array.isArray(resultList) ? resultList : [],
			totcnt: Number(totcnt),
			page: pageNum,
			limit: limitNum,
		});
	} catch (err) {
		next(err);
	}
};

/**
 * 가입 관리 고시원 정보 수정 (gosiwonRegist.update)
 * gosiwon 테이블 업데이트 + status가 DORMANT일 때 해당 고시원의 OPEN 방을 EMPTY로 변경
 */
exports.updateGosiwonRegist = async (req, res, next) => {
	const transaction = await mariaDBSequelize.transaction();
	try {
		const decodedToken = verifyAdminToken(req);
		const writerAdminId = getWriterAdminId(decodedToken);

		const {
			esntlId,
			corpNumber,
			name,
			address,
			address2,
			address3,
			latitude,
			longitude,
			status,
			rejectText,
			terminate_reason,
			terminate_date,
			adminSn,
			gsw_grade,
			bank,
			bankAccount,
			accountHolder,
			// 추가된 컬럼
			use_deposit,
			use_sale_commision,
			saleCommisionStartDate,
			saleCommisionEndDate,
			saleCommision,
			use_settlement,
			settlementReason,
			penaltyRate,
			penaltyMin,
			useDoklipPenaltyRule,
			is_controlled,
			is_favorite,
		} = req.body;

		if (!esntlId) {
			errorHandler.errorThrow(400, 'esntlId를 입력해주세요.');
		}

		const updaterSn = adminSn ?? writerAdminId;
		const process = status === 'OPERATE' || status === 'DORMANT' ? 'T' : 'F';
		const finalTerminateReason = status === 'FIN' || status === 'DORMANT' ? (terminate_reason ?? '') : '';
		const finalTerminateDate = status === 'FIN' || status === 'DORMANT' ? terminate_date ?? null : null;

		const updateFields = [
			'corpNumber = ?',
			'name = ?',
			'address = ?',
			'address2 = ?',
			'address3 = ?',
			'latitude = ?',
			'longitude = ?',
			'status = ?',
			'process = ?',
			'rejectText = ?',
			'terminate_reason = ?',
			'terminate_date = ?',
			'updater_sn = ?',
			'gsw_grade = ?',
			'bank = ?',
			'bankAccount = ?',
			'accountHolder = ?',
			'update_dtm = NOW()',
		];
		const updateValues = [
			corpNumber ?? null,
			name ?? null,
			address ?? null,
			address2 ?? null,
			address3 ?? null,
			latitude ?? null,
			longitude ?? null,
			status ?? null,
			process,
			rejectText ?? null,
			finalTerminateReason,
			finalTerminateDate,
			updaterSn ?? null,
			gsw_grade ?? null,
			bank ?? null,
			bankAccount ?? null,
			accountHolder ?? null,
		];

		// 추가된 컬럼 (gosiwon 테이블 alter_gosiwon)
		if (use_deposit !== undefined) {
			updateFields.push('use_deposit = ?');
			updateValues.push(use_deposit === true || use_deposit === 1 || use_deposit === '1' ? 1 : 0);
		}
		if (use_sale_commision !== undefined) {
			updateFields.push('use_sale_commision = ?');
			updateValues.push(use_sale_commision === true || use_sale_commision === 1 || use_sale_commision === '1' ? 1 : 0);
		}
		if (saleCommisionStartDate !== undefined) {
			updateFields.push('saleCommisionStartDate = ?');
			updateValues.push(saleCommisionStartDate || null);
		}
		if (saleCommisionEndDate !== undefined) {
			updateFields.push('saleCommisionEndDate = ?');
			updateValues.push(saleCommisionEndDate || null);
		}
		if (saleCommision !== undefined) {
			updateFields.push('saleCommision = ?');
			updateValues.push(saleCommision != null && saleCommision !== '' ? parseInt(saleCommision, 10) : null);
		}
		if (use_settlement !== undefined) {
			updateFields.push('use_settlement = ?');
			updateValues.push(use_settlement === true || use_settlement === 1 || use_settlement === '1' ? 1 : 0);
		}
		if (settlementReason !== undefined) {
			updateFields.push('settlementReason = ?');
			updateValues.push(settlementReason ?? null);
		}
		if (penaltyRate !== undefined) {
			updateFields.push('penaltyRate = ?');
			updateValues.push(penaltyRate != null && penaltyRate !== '' ? parseInt(penaltyRate, 10) : null);
		}
		if (penaltyMin !== undefined) {
			updateFields.push('penaltyMin = ?');
			updateValues.push(penaltyMin != null && penaltyMin !== '' ? parseInt(penaltyMin, 10) : 0);
		}
		if (useDoklipPenaltyRule !== undefined) {
			updateFields.push('useDoklipPenaltyRule = ?');
			updateValues.push(useDoklipPenaltyRule === true || useDoklipPenaltyRule === 1 || useDoklipPenaltyRule === '1' ? 1 : 0);
		}
		if (is_controlled !== undefined) {
			updateFields.push('is_controlled = ?');
			updateValues.push(is_controlled === true || is_controlled === 1 || is_controlled === '1' ? 1 : 0);
		}
		if (is_favorite !== undefined) {
			updateFields.push('is_favorite = ?');
			updateValues.push(is_favorite === true || is_favorite === 1 || is_favorite === '1' ? 1 : 0);
		}

		updateValues.push(esntlId);

		await mariaDBSequelize.query(
			`UPDATE gosiwon SET ${updateFields.join(', ')} WHERE esntlId = ?`,
			{
				replacements: updateValues,
				type: mariaDBSequelize.QueryTypes.UPDATE,
				transaction,
			}
		);

		// 상태를 휴면으로 변경할 경우 판매 게시(OPEN)된 모든 방을 EMPTY로 변경
		if (status === 'DORMANT') {
			await mariaDBSequelize.query(
				`UPDATE room SET status = 'EMPTY' WHERE gosiwonEsntlId = ? AND status = 'OPEN'`,
				{
					replacements: [esntlId],
					type: mariaDBSequelize.QueryTypes.UPDATE,
					transaction,
				}
			);
		}

		await transaction.commit();
		return errorHandler.successThrow(res, '가입 관리 고시원 정보 수정 성공');
	} catch (err) {
		await transaction.rollback();
		next(err);
	}
};
