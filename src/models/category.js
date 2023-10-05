module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_category',
      {
         id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         c_depth: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         c_depth_parent: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         c_num: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         c_name: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_main_banner: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_main_banner_file: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_menu_ui: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_menu_on_img: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_menu_off_img: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_content_type: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         c_use_yn: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         c_reg_date: {
            type: DataTypes.DATE,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
