const jwt = require("jsonwebtoken");
const { jwToken } = require("../config/config");

function verifyFn(token, key) {
   let decoded = null;
   try {
      decoded = jwt.verify(token, key);
      return {
         decoded: decoded,
      };
   } catch (err) {
      return {
         decoded: decoded,
         err: err,
      };
   }
}

module.exports = {
   access: (user, level) => {
      const payload = { user, level };
      return jwt.sign(payload, jwToken.secretkey, {
         algorithm: jwToken.option.algorithm,
         expiresIn: jwToken.option.expiresIn,
      });
   },
   refresh: (user, level) => {
      const payload = { user, level };
      return jwt.sign(payload, jwToken.refreshSecretkey, {
         algorithm: jwToken.option.algorithm,
         expiresIn: jwToken.option.refreshExpiresIn,
      });
   },
   accessVerify: (token) => {
      return verifyFn(token, jwToken.secretkey);
   },
   refreshVerify: (token) => {
      return verifyFn(token, jwToken.refreshSecretkey);
   },
};
