module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_member',
      {
         idx: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         m_email: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         m_password: {
            type: DataTypes.STRING(100),
            allowNull: true,
         },
         m_name: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         m_mobile: {
            type: DataTypes.STRING(13),
            allowNull: true,
         },
         m_sms_yn: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         m_mail_yn: {
            type: DataTypes.STRING(3),
            allowNull: true,
         },
         m_memo: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
         m_level: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         m_menu_auth: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         reg_date: {
            type: DataTypes.DATE,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
