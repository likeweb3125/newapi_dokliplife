module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_category_board_group',
      {
         id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         parent_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         g_num: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         g_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
         },
         g_menu_ui: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         g_img_on: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         g_img_off: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         use_yn: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         all_board: {
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
