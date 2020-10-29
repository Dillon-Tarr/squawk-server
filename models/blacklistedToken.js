const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
  string: {type: String, required: true, unique: true },
  blacklistedTime: { type: Date, default: Date.now }
});

const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistedTokenSchema);

module.exports.BlacklistedToken = BlacklistedToken;