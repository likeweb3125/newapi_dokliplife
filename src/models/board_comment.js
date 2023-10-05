module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_board_comment',
      {
         idx: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true,
         },
         board_idx: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         parent_idx: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         depth: {
            type: DataTypes.INTEGER,
            allowNull: true,
         },
         m_email: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         m_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         m_pwd: {
            type: DataTypes.STRING(100),
            allowNull: false,
         },
         c_contents: {
            type: DataTypes.TEXT,
            allowNull: false,
         },
         c_reg_date: {
            type: DataTypes.DATE,
         },
         a_read: {
            type: DataTypes.STRING(1),
            allowNull: true,
         },
         a_delete: {
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
