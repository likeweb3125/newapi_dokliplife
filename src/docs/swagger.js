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
					properties: {
						esntlId: { type: 'string', description: '고유 아이디' },
						name: { type: 'string', description: '고시원명' },
						address: { type: 'string' },
						address2: { type: 'string' },
						address3: { type: 'string' },
						longitude: { type: 'string' },
						latitude: { type: 'string' },
						status: { type: 'string' },
						process: { type: 'string' },
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

