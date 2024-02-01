module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'i_mailGun',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				allowNull: false,
				primaryKey: true,
			},
			user_id: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			user_pw: {
				type: DataTypes.STRING(100),
				allowNull: true,
			},
			user_name: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			user_level: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			reg_date: {
				type: DataTypes.DATE,
			},
		},
		{
			timestamps: false,
			freezeTableName: true,
		}
	);
};
