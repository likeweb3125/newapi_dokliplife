/* eslint-env node */
'use strict';

module.exports = {
  root: true,
  env: { node: true, es2021: true },
  parserOptions: { ecmaVersion: 2021 },
  rules: {
    // Date를 문자열로 쓸 때 toISOString() 사용 시 UTC 기준이라 KST 하루 밀림 발생. utils/dateHelper.dateToYmd 또는 middleware/dateJson.formatDateKST 사용.
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='toISOString']",
        message: 'toISOString() 사용 금지(UTC로 하루 밀림). 날짜만 필요하면 utils/dateHelper.dateToYmd, 날짜시간이 필요하면 middleware/dateJson.formatDateKST 사용.',
      },
    ],
  },
};
