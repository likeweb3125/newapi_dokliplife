const enumConfig = require('./enum');

exports.statusCodeReturn = (err, req, res, next) => {
   console.error(err); // Log the error for debugging (you can customize this)

   const statusCode =
      err.statusCode || enumConfig.statusErrorCode._500_ERROR[0];
   const message = err.message || enumConfig.statusErrorCode._500_ERROR[1];
   const data = err.data;

   res.status(statusCode).json({
      statusCode: statusCode,
      message: message,
      data: data,
   });
};

exports.routesStatusCode = (req, res, next) => {
   const statusCode = enumConfig.statusErrorCode._404_ERROR[0];
   const message = enumConfig.statusErrorCode._404_ERROR[1];

   res.status(404).json({
      statusCode: statusCode,
      message: message,
   });
};

exports.successThrow = (res, msg, data) => {
   res.status(200).json({
      statusCode: enumConfig.statusErrorCode._200_STATUS[0],
      message: msg || enumConfig.statusErrorCode._200_STATUS[1],
      data: data || null,
   });
};

exports.errorThrow = (status, msg) => {
   const error = new Error();
   error.statusCode = enumConfig.statusErrorCode[`_${status}_ERROR`][0];
   error.message = msg || enumConfig.statusErrorCode[`_${status}_ERROR`][1];
   throw error;
};
