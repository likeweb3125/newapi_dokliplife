exports.menuUiType = {
   TXT: ['TXT', '텍스트'],
   IMG: ['IMG', '이미지'],
};

exports.contentType = {
   HTML: [1, 'HTML'],
   EMPTY: [2, 'EMPTY'],
   CUSTOM: [3, 'CUSTOM'],
   BOARD: [4, 'BOARD'],
   GALLERY: [5, 'GALLERY'],
   FAQ: [6, 'FAQ'],
   QNA: [7, 'QNA'],
};

exports.categoryCustomType = {
   FORM: ['FORM', '폼메일(게시판)'],
   NORMAL: ['NORMAL', '일반'],
};

exports.statusErrorCode = {
   _200_STATUS: [200, 'Success.'],
   _400_ERROR: [400, 'Bad Request.'],
   _401_ERROR: [401, 'Unauthorized.'],
   _403_ERROR: [403, 'No authorization.'],
   _404_ERROR: [404, 'Not Found.'],
   _500_ERROR: [500, 'Internal Server Error.'],
};

exports.receiptType = {
   Y: ['Y', '수신'],
   N: ['N', '거부'],
};

exports.useType = {
   Y: ['Y', '사용'],
   N: ['N', '사용안함'],
   D: ['D', '삭제'],
};

exports.userLevel = {
   USER_LV0: 0, //이용제한
   USER_LV1: 1, //회원
   USER_LV2: 2,
   USER_LV3: 3,
   USER_LV4: 4,
   USER_LV5: 5,
   USER_LV6: 6,
   USER_LV7: 7,
   USER_LV8: 8,
   USER_LV9: 9, //관리자
};

exports.boardAuthType = {
   CREATE: 'create', // 쓰기
   READ: 'read', // 읽기
   REPLY: 'reply', // 답변
   COMMENT: 'comment', // 댓글
};

exports.bannerOpenType = {
   Y: ['Y', '노출'],
   N: ['N', '중단'],
};

exports.bannerType = {
   PC: ['P', 'PC'],
   MOBILE: ['M', 'Mobile'],
};

exports.bannerSizeType = {
   COVER: ['1', '커버'],
   ORIGINAL: ['2', '원본 사이즈 고정'],
};

exports.bannerCategoryType = {
   IMG: ['1', '이미지'],
   MOV: ['2', '동영상'],
   HTML: ['3', 'HTML'],
};

exports.bannerLinkType = {
   PARENT: ['1', '부모창'],
   BLANK: ['2', '새창'],
};

exports.bannerMovType = {
   DIRECT: ['1', '직접 업로드'],
   URL: ['2', 'URL'],
};

exports.popupType = {
   LAYER: ['1', '레이어'],
   POPUP: ['2', '팝업'],
};

exports.readType = {
   Y: ['Y', '읽음'],
   N: ['N', '안읽음'],
};
