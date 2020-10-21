const mongoose = require('mongoose');
const Joi = require('joi');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 6, maxlength: 18 },
  password: { type: String, required: true, unique: false, minlength: 8, maxlength: 30 },
  emailAddress: { type: String, required: true, unique: true, minlength: 6, maxlength: 255 },
//profilePicture: { type: Buffer??, required: true, unique: false},
  aboutMe: { type: String, required: true, unique: false, minlength: 0, maxlength: 1024 },
  birdCall: { type: String, required: true, unique: false, minlength: 0, maxlength: 30 },
  myBirds:  { type: Array, required: true, unique: false },
  birdsIWatch: { type: Array, required: true, unique: false },
  friends: { type: Array, required: true, unique: false },
  joinedDate: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

function validateUser(user) {
  const schema = Joi.object({
  username: Joi.string().required().min(6).max(18),
  password: Joi.string().required().min(8).max(30),
  emailAddress: Joi.string().required().email().min(6).max(255),
//profilePicture: 
  aboutMe: Joi.string().required().min(0).max(1024),
  birdCall: Joi.string().required().min(0).max(30),
  myBirds: Joi.array().required(),
  birdsIWatch: Joi.array().required(),
  friends: Joi.array().required()
  });
  return schema.validate(user);
}

module.exports.User = User;
module.exports.validateUser = validateUser;