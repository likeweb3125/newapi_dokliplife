module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_comment',
      {
         c_list_no: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         list_no: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         c_content: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
         c_name: {
            type: DataTypes.STRING(70),
            allowNull: true,
         },
         m_id: {
            type: DataTypes.STRING(12),
            allowNull: true,
         },
         c_password: {
            type: DataTypes.STRING(12),
            allowNull: true,
         },
         c_table: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_wdate: {
            type: DataTypes.DATE,
            defaultValue: sequelize.literal('GETDATE()'),
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
