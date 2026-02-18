const Sequelize = require('sequelize');
const path = require('path');

// MariaDB
const mariaDBConfig = require(__dirname + '/../config/config.js')[
	'development'
];
const db = {};

const mariaDBSequelize = new Sequelize(
	mariaDBConfig.database,
	mariaDBConfig.username,
	mariaDBConfig.password,
	mariaDBConfig
);

// 연결 직후·풀에서 획득할 때마다 세션 타임존을 한국 시간으로 고정 (NOW(), CURRENT_TIMESTAMP가 KST로 동작)
const setSessionTimezone = async (connection) => {
	if (connection && typeof connection.query === 'function') {
		const q = connection.query("SET time_zone = 'Asia/Seoul'");
		if (q && typeof q.then === 'function') await q;
		else await new Promise((resolve, reject) => { connection.query("SET time_zone = 'Asia/Seoul'", (err) => (err ? reject(err) : resolve())); });
	}
};
mariaDBSequelize.addHook('afterConnect', setSessionTimezone);
mariaDBSequelize.addHook('afterPoolAcquire', setSessionTimezone);

db.mariaDBSequelize = mariaDBSequelize;

// DB 연결
db.i_logs = require('./logs')(mariaDBSequelize, Sequelize);

db.i_category = require('./category')(mariaDBSequelize, Sequelize);
db.i_category_html = require('./category_html')(mariaDBSequelize, Sequelize);
db.i_category_empty = require('./category_empty')(mariaDBSequelize, Sequelize);
db.i_category_custom = require('./category_custom')(
	mariaDBSequelize,
	Sequelize
);
db.i_category_board = require('./category_board')(mariaDBSequelize, Sequelize);
db.i_category_board_group = require('./category_board_group')(
	mariaDBSequelize,
	Sequelize
);

db.i_board = require('./board')(mariaDBSequelize, Sequelize);
db.i_board_comment = require('./board_comment')(mariaDBSequelize, Sequelize);
db.i_board_file = require('./board_file')(mariaDBSequelize, Sequelize);

db.i_member = require('./member')(mariaDBSequelize, Sequelize);
db.i_member_level = require('./member_level')(mariaDBSequelize, Sequelize);
db.i_member_login = require('./member_login')(mariaDBSequelize, Sequelize);
db.i_member_sec = require('./member_sec')(mariaDBSequelize, Sequelize);
db.i_sms_txt = require('./sms_txt')(mariaDBSequelize, Sequelize);

db.i_banner = require('./banner')(mariaDBSequelize, Sequelize);
db.i_popup = require('./popup')(mariaDBSequelize, Sequelize);

db.i_config = require('./config')(mariaDBSequelize, Sequelize);
db.i_config_lang = require('./config_lang')(mariaDBSequelize, Sequelize);
db.i_policy = require('./policy')(mariaDBSequelize, Sequelize);
db.i_mailGun = require('./mailGun')(mariaDBSequelize, Sequelize);

db.gosiwon = require('./gosiwon')(mariaDBSequelize, Sequelize);
db.room = require('./room')(mariaDBSequelize, Sequelize);
db.roomCategory = require('./roomCategory')(mariaDBSequelize, Sequelize);
db.roomCategoryOption = require('./roomCategoryOption')(mariaDBSequelize, Sequelize);
db.customer = require('./customer')(mariaDBSequelize, Sequelize);
db.parking = require('./parking')(mariaDBSequelize, Sequelize);
db.roomMemo = require('./roomMemo')(mariaDBSequelize, Sequelize);
db.deposit = require('./deposit')(mariaDBSequelize, Sequelize);
db.depositHistory = require('./depositHistory')(mariaDBSequelize, Sequelize);
db.ilRoomDeposit = require('./ilRoomDeposit')(mariaDBSequelize, Sequelize);
db.ilRoomDepositHistory = require('./ilRoomDepositHistory')(mariaDBSequelize, Sequelize);
db.depositDeduction = require('./depositDeduction')(mariaDBSequelize, Sequelize);
db.depositRefund = require('./depositRefund')(mariaDBSequelize, Sequelize);
db.memo = require('./memo')(mariaDBSequelize, Sequelize);
db.history = require('./history')(mariaDBSequelize, Sequelize);
db.parkStatus = require('./parkStatus')(mariaDBSequelize, Sequelize);
db.ilRoomRefundRequest = require('./ilRoomRefundRequest')(
	mariaDBSequelize,
	Sequelize
);
db.refund = require('./refund')(mariaDBSequelize, Sequelize);
db.paymentLog = require('./paymentLog')(
	mariaDBSequelize,
	Sequelize
);
db.extraPayment = require('./extraPayment')(
	mariaDBSequelize,
	Sequelize
);

db.i_category.hasMany(db.i_board, { as: 'iboard' });
db.i_board.belongsTo(db.i_category, {
	foreignKey: 'category',
	as: 'icategory',
});

db.roomCategory.hasMany(db.roomCategoryOption, {
	as: 'options',
	foreignKey: 'categoryEsntlId',
	sourceKey: 'esntlId',
});
db.roomCategoryOption.belongsTo(db.roomCategory, {
	as: 'category',
	foreignKey: 'categoryEsntlId',
	targetKey: 'esntlId',
});

db.room.hasMany(db.roomMemo, {
	as: 'memos',
	foreignKey: 'roomEsntlId',
	sourceKey: 'esntlId',
});
db.roomMemo.belongsTo(db.room, {
	as: 'room',
	foreignKey: 'roomEsntlId',
	targetKey: 'esntlId',
});

db.parking.belongsTo(db.gosiwon, {
	as: 'gosiwon',
	foreignKey: 'gosiwonEsntlId',
	targetKey: 'esntlId',
});


// Deposit 관계 설정
db.room.hasMany(db.deposit, {
	as: 'deposits',
	foreignKey: 'roomEsntlId',
	sourceKey: 'esntlId',
});
db.deposit.belongsTo(db.room, {
	as: 'room',
	foreignKey: 'roomEsntlId',
	targetKey: 'esntlId',
});

db.gosiwon.hasMany(db.deposit, {
	as: 'deposits',
	foreignKey: 'gosiwonEsntlId',
	sourceKey: 'esntlId',
});
db.deposit.belongsTo(db.gosiwon, {
	as: 'gosiwon',
	foreignKey: 'gosiwonEsntlId',
	targetKey: 'esntlId',
});

db.deposit.belongsTo(db.customer, {
	as: 'customer',
	foreignKey: 'customerEsntlId',
	targetKey: 'esntlId',
});

db.deposit.belongsTo(db.customer, {
	as: 'contractor',
	foreignKey: 'contractorEsntlId',
	targetKey: 'esntlId',
});

db.deposit.hasMany(db.depositHistory, {
	as: 'histories',
	foreignKey: 'depositEsntlId',
	sourceKey: 'esntlId',
});
db.depositHistory.belongsTo(db.deposit, {
	as: 'deposit',
	foreignKey: 'depositEsntlId',
	targetKey: 'esntlId',
});

db.depositHistory.hasMany(db.depositDeduction, {
	as: 'deductions',
	foreignKey: 'depositHistoryEsntlId',
	sourceKey: 'esntlId',
});
db.depositDeduction.belongsTo(db.depositHistory, {
	as: 'depositHistory',
	foreignKey: 'depositHistoryEsntlId',
	targetKey: 'esntlId',
});

// il_room_deposit 관계 설정
db.room.hasMany(db.ilRoomDeposit, {
	as: 'ilRoomDeposits',
	foreignKey: 'roomEsntlId',
	sourceKey: 'esntlId',
});
db.ilRoomDeposit.belongsTo(db.room, {
	as: 'room',
	foreignKey: 'roomEsntlId',
	targetKey: 'esntlId',
});
db.gosiwon.hasMany(db.ilRoomDeposit, {
	as: 'ilRoomDeposits',
	foreignKey: 'gosiwonEsntlId',
	sourceKey: 'esntlId',
});
db.ilRoomDeposit.belongsTo(db.gosiwon, {
	as: 'gosiwon',
	foreignKey: 'gosiwonEsntlId',
	targetKey: 'esntlId',
});
db.ilRoomDeposit.hasMany(db.ilRoomDepositHistory, {
	as: 'histories',
	foreignKey: 'depositEsntlId',
	sourceKey: 'esntlId',
});
db.ilRoomDepositHistory.belongsTo(db.ilRoomDeposit, {
	as: 'ilRoomDeposit',
	foreignKey: 'depositEsntlId',
	targetKey: 'esntlId',
});

// DepositHistory와 Room 관계 설정
db.room.hasMany(db.depositHistory, {
	as: 'depositHistories',
	foreignKey: 'roomEsntlId',
	sourceKey: 'esntlId',
});
db.depositHistory.belongsTo(db.room, {
	as: 'room',
	foreignKey: 'roomEsntlId',
	targetKey: 'esntlId',
});

// MSSQL
const mssqlDBConfig = require(__dirname + '/../config/config.js')[
	'maintenance'
];

const mssqlDBSequelize = new Sequelize(
	mssqlDBConfig.database,
	mssqlDBConfig.username,
	mssqlDBConfig.password,
	mssqlDBConfig
);

db.mssqlDBSequelize = mssqlDBSequelize;

db.ib_admin = require('./ib_admin')(mssqlDBSequelize, Sequelize);
db.i_comment = require('./i_comment')(mssqlDBSequelize, Sequelize);

module.exports = db;
