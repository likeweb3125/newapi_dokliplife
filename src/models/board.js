module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_board',
      {
         idx: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         category: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         m_email: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         m_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         m_pwd: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         b_title: {
            type: DataTypes.STRING(100),
            allowNull: false,
         },
         b_contents: {
            type: DataTypes.TEXT,
            allowNull: false,
         },
         b_reg_date: {
            type: DataTypes.DATE,
         },
         parent_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         b_depth: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         b_notice: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_view: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         b_img: {
            type: DataTypes.STRING(500),
            allowNull: true,
         },
         b_file: {
            type: DataTypes.STRING(500),
            allowNull: true,
         },
         b_sms_yn: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_sms_phone: {
            type: DataTypes.STRING(13),
            allowNull: true,
         },
         b_email_yn: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_email: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_recom: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         b_secret: {
            type: DataTypes.STRING(4),
            allowNull: true,
         },
         a_read: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         a_delete: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_status: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
