module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_member_level',
      {
         l_level: {
            type: DataTypes.INTEGER,
            allowNull: true,
            primaryKey: true,
         },
         l_name: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         signup_lv: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
