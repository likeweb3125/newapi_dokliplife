module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'i_config_lang',
		{
			site_id: {
				type: DataTypes.STRING(100),
				allowNull: true,
			},
			site_lang: {
				type: DataTypes.STRING(100),
				allowNull: true,
			},
			use_yn: {
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
