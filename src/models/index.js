const Sequelize = require('sequelize');

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
db.i_policy = require('./policy')(mariaDBSequelize, Sequelize);

db.i_category.hasMany(db.i_board, { as: 'iboard' });
db.i_board.belongsTo(db.i_category, {
   foreignKey: 'category',
   as: 'icategory',
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
