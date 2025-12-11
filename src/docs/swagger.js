const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
	definition: {
		openapi: '3.0.0',
		info: {
			title: 'Dokliplife API',
			version: '1.0.0',
			description:
				'Dokliplife API 문서입니다. JWT Bearer 토큰을 이용해 인증합니다.',
		},
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
				},
			},
			schemas: {
				GosiwonInfo: {
					type: 'object',
					description: '고시원 정보 (gosiwon, room, gosiwonUse, gosiwonBuilding, gosiwonFacilities, gosiwonAdmin 조인 결과)',
					properties: {
						esntlId: { type: 'string', description: '고유 아이디' },
						name: { type: 'string', description: '고시원명' },
						address: { type: 'string', description: '주소' },
						address2: { type: 'string', description: '상세주소' },
						address3: { type: 'string', description: '참고주소' },
						longitude: { type: 'string', description: '경도' },
						latitude: { type: 'string', description: '위도' },
						status: { type: 'string', description: '고시원상태' },
						process: { type: 'string', description: '운영여부' },
						penaltyRate: { type: 'integer', description: '위약금 비율' },
						penaltyMin: { type: 'integer', description: '최소 위약금' },
						// room 테이블 필드들 (예시)
						gosiwonEsntlId: { type: 'string', description: '고시원 고유아이디 (room 테이블)' },
						roomType: { type: 'string', description: '방타입' },
						deposit: { type: 'integer', description: '보증금' },
						monthlyRent: { type: 'string', description: '입실료' },
						// gosiwonUse, gosiwonBuilding, gosiwonFacilities, gosiwonAdmin 테이블 필드들
						// 실제 컬럼명은 동적으로 포함됨
					},
				},
				GosiwonUse: {
					type: 'object',
					description: '고시원 사용 정보',
					properties: {
						esntlId: { type: 'string', description: '고시원 고유아이디' },
					},
				},
				GosiwonBuilding: {
					type: 'object',
					description: '고시원 건물 정보',
					properties: {
						esntlId: { type: 'string', description: '고시원 고유아이디' },
					},
				},
				GosiwonFacilities: {
					type: 'object',
					description: '고시원 시설 정보',
					properties: {
						esntlId: { type: 'string', description: '고시원 고유아이디' },
					},
				},
				StandardError: {
					type: 'object',
					properties: {
						statusCode: { type: 'integer' },
						message: { type: 'string' },
					},
				},
			},
			responses: {
				BadRequest: {
					description: '잘못된 요청',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/StandardError',
							},
							example: {
								statusCode: 400,
								message: '잘못된 요청입니다.',
							},
						},
					},
				},
				Unauthorized: {
					description: '인증 실패 (토큰 없음 또는 유효하지 않음)',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/StandardError',
							},
							example: {
								statusCode: 401,
								message: '토큰이 없습니다.',
							},
						},
					},
				},
				NotFound: {
					description: '리소스를 찾을 수 없음',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/StandardError',
							},
							example: {
								statusCode: 404,
								message: '리소스를 찾을 수 없습니다.',
							},
						},
					},
				},
				InternalServerError: {
					description: '서버 내부 오류',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/StandardError',
							},
							example: {
								statusCode: 500,
								message: '서버 내부 오류가 발생했습니다.',
							},
						},
					},
				},
			},
		},
		security: [
			{
				bearerAuth: [],
			},
		],
	},
	apis: [path.join(__dirname, '../routes/*.js')],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;

