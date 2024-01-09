const multer = require('multer');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

const fileStorage = (destination) =>
   multer.diskStorage({
      destination: (req, file, cb) => {
         console.log('Destination:', destination);
         console.log(destination);
         cb(null, destination);
      },
      filename: (req, file, cb) => {
         //const originalName = Buffer.from(file.originalname, 'latin1').toString(
         //   'utf8'
         //);
console.log(file.originalname)
         const originalName = file.originalname;

         const _fileLen = originalName.length;
         const _lastDot = originalName.lastIndexOf('.') + 1;
         const _fileNameWithoutExt = originalName.substring(0, _lastDot - 1);
         const _fileExt = originalName
            .substring(_lastDot, _fileLen)
            .toLowerCase();
         const _fileName =
            _fileNameWithoutExt +
            '_' +
            moment.utc().format('YYYYMMDDHHmmssSSS') +
            '.' +
            _fileExt;
         cb(null, _fileName);
      },
   });

const allowedMimeTypes = [
   'image/png',
   'image/jpg',
   'image/jpeg',
   'image/gif',
   'application/pdf',
   'application/msword', // .doc
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
   'application/vnd.ms-powerpoint', // .ppt
   'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
   'application/vnd.ms-excel', // .xls
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
   'application/x-hwp', // HWP files
   'application/zip', // ZIP files
   'text/plain',
];

const fileFilter = (req, file, cb) => {
   const fileExtension = file.originalname.split('.').pop().toLowerCase();
   if (allowedMimeTypes.includes(file.mimetype) && fileExtension !== 'exe') {
      cb(null, true);
   } else {
      cb(null, false);
   }
};

exports.clearFile = (filePath) => {
   filePath = path.join(__dirname, '../../', filePath);
   fs.unlink(filePath, (err) => console.log(err));
};

// Add a file size limit (in bytes)
const fileSizeLimit = 5 * 1024 * 1024; // 5MB
const fieldSizeLimit = 50 * 1024 * 1024; // 50MB

exports.fileMulter = multer({
   storage: fileStorage('upload/board'),
   fileFilter: fileFilter,
   limits: { fileSize: fileSizeLimit, fieldSize: fieldSizeLimit },
}).fields([
   { name: 'b_file', maxCount: 10 },
   { name: 'b_img', maxCount: 1 },
]);

exports.menuFileMulter = multer({
   storage: fileStorage('upload/menu'),
   fileFilter: fileFilter,
   limits: { fileSize: fileSizeLimit, fieldSize: fieldSizeLimit },
}).fields([
   { name: 'c_main_banner_file', maxCount: 1 },
   { name: 'c_menu_on_img', maxCount: 1 },
   { name: 'c_menu_off_img', maxCount: 1 },
]);

exports.groupFileMulter = multer({
   storage: fileStorage('upload/menu'),
   fileFilter: fileFilter,
   limits: { fileSize: fileSizeLimit },
}).fields([
   { name: 'g_img_on', maxCount: 1 },
   { name: 'g_img_off', maxCount: 1 },
]);

exports.bannerMulter = multer({
   storage: fileStorage('upload/banner'),
   fileFilter: fileFilter,
   limits: { fileSize: fileSizeLimit },
}).single('b_file');
