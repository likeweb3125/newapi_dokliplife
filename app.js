/*
// Project      : Basic Solution
// Copyright    : likeweb
// FileName     : app.js
// StartDate    : 2023.08.23 ash
// Discription  : Basic Solution REST API
//                베이직 솔루션
*/

// 환경 변수 로드 (가장 먼저 실행)
require('dotenv').config();

const http = require('http');
const express = require('express');
const app = express();

const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/docs/swagger');

const boardRoutes = require('./src/routes/board');
const commentRoutes = require('./src/routes/comment');
const authRoutes = require('./src/routes/auth');

const adminFirstRoutes = require('./src/routes/first');
const adminMenuRoutes = require('./src/routes/menu');
const adminMemberRoutes = require('./src/routes/member');
const adminBannerRoutes = require('./src/routes/banner');
const adminPopupRoutes = require('./src/routes/popup');

const adminConfigRoutes = require('./src/routes/config');
const adminStatisticsRoutes = require('./src/routes/statistics');

const adminMaintenanceRoutes = require('./src/routes/maintenance');

const mailGunRoutes = require('./src/routes/mailGun');
const gosiwonRoutes = require('./src/routes/gosiwon');
const roomRoutes = require('./src/routes/room');
const depositRoutes = require('./src/routes/deposit');
const memoRoutes = require('./src/routes/memo');
const historyRoutes = require('./src/routes/history');
const parkStatusRoutes = require('./src/routes/parkStatus');
const roomContractRoutes = require('./src/routes/roomContract');
const refundRoutes = require('./src/routes/refund');
const extraPaymentRoutes = require('./src/routes/extraPayment');

const errorHandler = require('./src/middleware/error');
const { logs } = require('./src/middleware/logs');

// CORS_ORIGINS 환경 변수에서 허용할 origin 목록 가져오기
const corsOrigins = process.env.CORS_ORIGINS
	? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
	: [
			'http://localhost:3050/',
			'https://dokliplife.likeweb.co.kr/',
	  ]; // 기본값

const corsOptions = {
	origin: corsOrigins,
	methods: ['GET', 'PUT', 'POST', 'DELETE'],
};

app.use(cors(corsOptions));

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(bodyParser.urlencoded({ extended: true })); // x-www-form-urlencoded <form>
app.use(bodyParser.json());

app.use('/upload', express.static(path.join(__dirname, 'upload')));

// Swagger Docs
const swaggerUiOptions = {
	swaggerOptions: {
		persistAuthorization: true,
	},
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// logs
app.use(async (req, res, next) => {
	await logs(req, res, next);
});

// Routes
app.use('/v1/board', boardRoutes);
app.use('/v1/comment', commentRoutes);
app.use('/v1/auth', authRoutes);

// Admin Routes //
app.use('/v1/admin/first', adminFirstRoutes);
app.use('/v1/admin/menu', adminMenuRoutes);

app.use('/v1/admin/member', adminMemberRoutes);
app.use('/v1/admin/banner', adminBannerRoutes);
app.use('/v1/admin/popup', adminPopupRoutes);
app.use('/v1/admin/config', adminConfigRoutes);
app.use('/v1/admin/stat', adminStatisticsRoutes);

// 유지보수 Routes
app.use('/v1/admin/maintenance', adminMaintenanceRoutes);

// 메일 Send
app.use('/v1/mailGun', mailGunRoutes);

// 고시원 Routes
app.use('/v1/gosiwon', gosiwonRoutes);

// 방 Routes
app.use('/v1/room', roomRoutes);

// 보증금 Routes
app.use('/v1/deposit', depositRoutes);

// 메모 Routes
app.use('/v1/memo', memoRoutes);

// 히스토리 Routes
app.use('/v1/history', historyRoutes);

// 주차 상태 Routes
app.use('/v1/parkStatus', parkStatusRoutes);

// 계약현황 Routes
app.use('/v1/roomContract', roomContractRoutes);

// 환불 Routes
app.use('/v1/refund', refundRoutes);

// 추가 결제 Routes
app.use('/v1/roomExtraPayment', extraPaymentRoutes);

app.get('/', (req, res) => {
	res.send('Welcome to Doklip Life REST API');
});

app.use(errorHandler.routesStatusCode);

app.use(errorHandler.statusCodeReturn);

app.listen(5001);
