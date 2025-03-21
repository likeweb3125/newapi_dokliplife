/*
// Project      : Basic Solution
// Copyright    : likeweb
// FileName     : app.js
// StartDate    : 2023.08.23 ash
// Discription  : Basic Solution REST API
//                베이직 솔루션
*/

const http = require('http');
const express = require('express');
const app = express();

const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const bodyParser = require('body-parser');

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

const errorHandler = require('./src/middleware/error');
const { logs } = require('./src/middleware/logs');

const corsOptions = {
	origin: [
		'http://api.likeweb.co.kr:5001/',
		'http://api.likeweb.co.kr/',
		'http://localhost:5001',
		'http://localhost:3002',
		'http://localhost:3007',
		'http://react.likeweb.co.kr',
		'http://likeweb.co.kr',
		'http://www.likeweb.co.kr',
		'http://woodism.likeweb.kr',
		'http://woodismcity.org',
		'http://www.woodismcity.org',
		'http://cielodoor.com',
		'http://www.cielodoor.com',
	], // 리액트  localhost 3000
	methods: ['GET', 'PUT', 'POST', 'DELETE'],
};

app.use(cors(corsOptions));

app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(bodyParser.urlencoded({ extended: true })); // x-www-form-urlencoded <form>
app.use(bodyParser.json());

app.use('/upload', express.static(path.join(__dirname, 'upload')));

// logs
app.use((req, res, next) => {
	logs(req, res, next);
	next();
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

app.get('/', (req, res) => {
	res.send('Welcome to LIKE WEB BASIC REST API');
});

app.use(errorHandler.routesStatusCode);

app.use(errorHandler.statusCodeReturn);

app.listen(5001);
