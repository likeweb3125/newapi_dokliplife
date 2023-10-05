module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_member_login',
      {
         id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         m_email: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         log_date: {
            type: DataTypes.DATE,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
