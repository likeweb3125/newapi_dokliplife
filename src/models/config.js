module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_config',
      {
         site_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_site_name: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_web_title: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_eco: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_tel: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_num: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_email: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_address: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_fax: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_manager: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_meta: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_meta_tag: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         c_meta_type: {
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
