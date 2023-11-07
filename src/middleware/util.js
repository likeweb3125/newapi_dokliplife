const fs = require('fs');
const path = require('path');

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
               'http://api.likeweb.co.kr/' + imagePath
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
