module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_member_sec',
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
         sec_date: {
            type: DataTypes.DATE,
         },
         memo: {
            type: DataTypes.TEXT,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
