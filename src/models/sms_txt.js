module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_sms_txt',
      {
         idx: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         send_txt: {
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
