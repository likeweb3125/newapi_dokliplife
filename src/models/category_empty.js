module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'i_category_empty',
		{
			parent_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
			},
			use_yn: {
				type: DataTypes.ENUM('Y', 'N'),
				allowNull: false,
			},
		},
		{
			timestamps: false,
			freezeTableName: true,
		}
	);
};
