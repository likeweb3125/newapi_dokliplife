module.exports = (sequelize, DataTypes) => {
   return sequelize.define(
      'i_category_board',
      {
         parent_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
         },
         b_list_cnt: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         b_column_title: {
            type: DataTypes.STRING(10),
            allowNull: false,
         },
         b_column_date: {
            type: DataTypes.STRING(10),
            allowNull: false,
         },
         b_column_view: {
            type: DataTypes.STRING(10),
            allowNull: false,
         },
         b_column_recom: {
            type: DataTypes.STRING(10),
            allowNull: false,
         },
         b_column_file: {
            type: DataTypes.STRING(10),
            allowNull: false,
         },
         b_thumbnail_with: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         b_thumbnail_height: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         b_thumbnail: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         b_read_lv: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         b_write_lv: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         b_group: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         b_secret: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         b_reply: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         b_reply_lv: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         b_comment: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         b_comment_lv: {
            type: DataTypes.INTEGER,
            allowNull: false,
         },
         b_write_alarm: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_write_send: {
            type: DataTypes.STRING(50),
            allowNull: true,
         },
         b_alarm: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         b_alarm_phone: {
            type: DataTypes.STRING(50),
            allowNull: false,
         },
         b_top_html: {
            type: DataTypes.TEXT,
            allowNull: false,
         },
         b_template: {
            type: DataTypes.STRING(1),
            allowNull: false,
         },
         b_template_text: {
            type: DataTypes.TEXT,
            allowNull: false,
         },
         use_yn: {
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
