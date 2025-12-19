const express = require('express');
const router = express.Router();

const parkStatusController = require('../controllers/parkStatus');

// Swagger 문서 숨김 처리 - ParkStatus API는 Swagger에 표시되지 않습니다

router.get('/list', parkStatusController.getParkStatusList);

router.post('/', parkStatusController.createParkStatus);

router.get('/:parkStatusId', parkStatusController.getParkStatusDetail);

router.put('/:parkStatusId', parkStatusController.updateParkStatus);

router.delete('/:parkStatusId', parkStatusController.deleteParkStatus);

module.exports = router;
