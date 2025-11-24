const express = require('express');
const router = express.Router();

const gosiwonController = require('../controllers/gosiwon');

// 고시원 정보 조회
router.post('/info', gosiwonController.getGosiwonInfo);

// 고시원 이름 목록 조회
router.post('/names', gosiwonController.getGosiwonNames);

module.exports = router;

