const mongoose = require('mongoose');
const Joi = require('joi');
const config = require('config');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 6, maxlength: 18 },
  password: { type: String, required: true, unique: false },
  emailAddress: { type: String, required: true, unique: true, minlength: 6, maxlength: 255 },
  isOnline: { type: Boolean },
//profilePicture: { type: Buffer??, required: true, unique: false},
  aboutMe: { type: String, required: false, unique: false, minlength: 0, maxlength: 1024 },
  birdCall: { type: String, required: false, unique: false, minlength: 0, maxlength: 30 },
  myBirds:  { type: Array, required: false, unique: false },
  birdsIWatch: { type: Array, required: false, unique: false },
  friends: { type: Array, required: false, unique: false },
  joinedDate: { type: Date, default: Date.now }
});

userSchema.methods.generateAuthToken = () => {
  return jwt.sign({ _id: user._id, username: user.username }, config.get('jwtSecret'));
 };

const User = mongoose.model('User', userSchema);

function validateUser(user) {
  const schema = Joi.object({
  username: Joi.string().required().min(6).max(18),
  password: Joi.string().required(),
  emailAddress: Joi.string().required().email().min(6).max(255),
  isOnline: Joi.boolean(),
//profilePicture: 
  aboutMe: Joi.string().min(0).max(1024).allow(""),
  birdCall: Joi.string().min(0).max(30).allow(""),
  myBirds: Joi.array(),
  birdsIWatch: Joi.array(),
  friends: Joi.array()
  });
  return schema.validate(user);
}

module.exports.User = User;
module.exports.validateUser = validateUser;