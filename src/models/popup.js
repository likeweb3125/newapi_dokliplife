module.exports = (sequelize, DataTypes) => {
	return sequelize.define(
		'i_popup',
		{
			idx: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				allowNull: false,
				primaryKey: true,
			},
			p_type: {
				type: DataTypes.STRING(1),
				allowNull: true,
			},
			p_open: {
				type: DataTypes.STRING(1),
				allowNull: true,
			},
			p_title: {
				type: DataTypes.STRING(50),
				allowNull: true,
			},
			p_s_date: {
				type: DataTypes.STRING(10),
				allowNull: true,
			},
			p_e_date: {
				type: DataTypes.STRING(10),
				allowNull: true,
			},
			p_one_day: {
				type: DataTypes.STRING(10),
				allowNull: true,
			},
			p_layer_pop: {
				type: DataTypes.STRING(10),
				allowNull: true,
			},
			p_width_size: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			p_height_size: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			p_left_point: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			p_top_point: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			p_scroll: {
				type: DataTypes.STRING(1),
				allowNull: true,
			},
			p_link_target: {
				type: DataTypes.STRING(1),
				allowNull: true,
			},
			p_link_url: {
				type: DataTypes.STRING(500),
				allowNull: true,
			},
			p_content: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			p_lang: {
				type: DataTypes.STRING(100),
				allowNull: true,
			},
		},
		{
			timestamps: false,
			freezeTableName: true,
		}
	);
};
