module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_category_empty',
      {
         parent_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
