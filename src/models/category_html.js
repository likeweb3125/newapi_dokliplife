module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_category_html',
      {
         parent_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
         },
         content: {
            type: DataTypes.TEXT,
            allowNull: false,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
