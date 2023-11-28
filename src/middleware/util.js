const { i_config } = require('../models');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '/config/env/.env') });
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const errorHandler = require('../middleware/error');

//게시글 내용 base64 이미지 변경
exports.base64ToImagesPath = async (b_contents) => {
   let temp_contents = b_contents;

   const imageMatches = temp_contents.match(/data:image\/\w+;base64,([^"]+)/g);
   const imagePaths = [];

   if (imageMatches) {
      for (let index = 0; index < imageMatches.length; index++) {
         const imageData = imageMatches[index];
         const imageDataWithoutPrefix = imageData.replace(
            /^data:image\/\w+;base64,/,
            ''
         );
         const decodedImage = Buffer.from(imageDataWithoutPrefix, 'base64');

         // 이미지 파일 경로 및 이름 생성
         const imageName = Date.now() + '_' + index + '.jpg';
         const imagePath = 'upload/board/' + imageName;
         imagePaths.push(imagePath);

         // 이미지 파일을 저장
         try {
            await fs.promises.writeFile(imagePath, decodedImage);
            //console.log('Image saved as ' + imagePath);

            // Replace the base64 data with the image path in temp_contents
            temp_contents = temp_contents.replace(
               imageData,
               process.env.API_URL + imagePath
            );
         } catch (err) {
            console.error('Failed to save the image: ' + err);
            throw new Error('Image upload failed');
         }
      }
   }

   //console.log(temp_contents);
   //console.log(imagePaths);
   return { temp_contents, imagePaths };
};

//이메일 전송
exports.postEmailSendGun = async (
   res,
   to_email,
   from_email,
   subject,
   contents
) => {
   try {
      if (to_email === '') {
         const configView = await i_config.findOne(
            {
               attributes: ['c_email'],
            },
            {
               where: {
                  site_id: 'clearlasik',
               },
            }
         );
         to_email = configView.c_email;
         from_email = configView.c_email;

         if (!configView) {
            errorHandler.errorThrow(404, '');
         }
      }

      const mg = mailgun.client({
         username: 'api',
         key: process.env.MAILGUN_API_KEY,
      });

      const data = {
         from: from_email,
         to: to_email,
         subject: subject,
         html: contents,
      };

      const email_result = await mg.messages.create(
         process.env.MAILER_HOST,
         data
      );

      console.log('이메일 전송 완료:', data);
      return email_result;
   } catch (error) {
      console.log('이메일 전송 오류:', error);
      throw error;
   }
};
