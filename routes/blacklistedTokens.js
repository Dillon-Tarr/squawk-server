const { BlacklistedToken } = require('../models/blacklistedToken');
const express = require('express');
const router = express.Router();

//Remove old blacklisted tokens, if they exist
router.delete('/old-tokens', async (req, res) => {
  try {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oldTokens = await BlacklistedToken.find({ blacklistedTime: {$lt: oneHourAgo } });
    for (let i = 0; i < oldTokens.length; i++){
      await BlacklistedToken.findByIdAndDelete(oldTokens[i]._id);
    }
    
    return res.send({ deletedTokens: oldTokens });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

module.exports = router;