module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_logs',
      {
         id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         user: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         clientIp: {
            type: DataTypes.STRING(14),
            allowNull: true,
         },
         previousUrl: {
            type: DataTypes.STRING(500),
            allowNull: true,
         },
         userAgent: {
            type: DataTypes.STRING(100),
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
