module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'ib_admin',
      {
         list_no: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         category_id: {
            type: DataTypes.STRING(100),
            allowNull: false,
         },
         m_id: {
            type: DataTypes.STRING(12),
            allowNull: true,
         },
         name: {
            type: DataTypes.STRING(70),
            allowNull: true,
         },
         password: {
            type: DataTypes.STRING(10),
            allowNull: true,
         },
         email: {
            type: DataTypes.STRING(300),
            allowNull: true,
         },
         company: {
            type: DataTypes.STRING(500),
            allowNull: true,
         },
         subject: {
            type: DataTypes.STRING(200),
            allowNull: true,
         },
         contents: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
         notice: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         reply_step: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         reply_level: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         reply: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         b_file: {
            type: DataTypes.STRING(600),
            allowNull: true,
         },
         b_img: {
            type: DataTypes.STRING(600),
            allowNull: true,
         },
         counter: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         w_date: {
            type: DataTypes.DATE,
            defaultValue: sequelize.literal('GETDATE()'), // 현재 날짜 및 시간을 기본값으로 설정
         },
         recommend: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         bad: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         m_tel: {
            type: DataTypes.STRING(30),
            allowNull: true,
         },
         m_email: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         lock: {
            type: DataTypes.STRING(10),
            allowNull: true,
         },
         process: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         comment: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
