module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_category_custom',
      {
         parent_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
         },
         c_type: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         file_path: {
            type: DataTypes.STRING(100),
            allowNull: false,
         },
         admin_file_path: {
            type: DataTypes.STRING(100),
            allowNull: false,
         },
         sms: {
            type: DataTypes.STRING(13),
            allowNull: false,
         },
         email: {
            type: DataTypes.STRING(100),
            allowNull: false,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
