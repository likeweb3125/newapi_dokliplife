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

