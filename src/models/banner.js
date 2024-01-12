module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_banner',
      {
         idx: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         b_type: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_open: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_title: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_s_date: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_e_date: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_size: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_width_size: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         b_height_size: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         b_c_type: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_file: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_mov_url: {
            type: DataTypes.STRING(500),
            allowNull: true,
         },
         b_url: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_url_target: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_mov_type: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_mov_play: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_mov_sound: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         b_content: {
            type: DataTypes.TEXT,
            allowNull: true,
         },
         b_movenum: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
