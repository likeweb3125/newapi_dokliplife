module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_board_file',
      {
         idx: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         parent_idx: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         file_name: {
            type: DataTypes.STRING(500),
            allowNull: false,
         },
         original_name: {
            type: DataTypes.STRING(500),
            allowNull: true,
         },
         reg_date: {
            type: DataTypes.DATE,
         },
         kind: {
            type: DataTypes.STRING(1),
            allowNull: false,
         },
      },
      {
         timestamps: false,
         freezeTableName: true,
      }
   );
};
