module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_policy',
      {
         idx: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         p_title: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         p_contents: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
         p_reg_date: {
            type: DataTypes.DATE,
         },
         p_use_yn: {
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
