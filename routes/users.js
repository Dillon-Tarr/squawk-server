const {User, validateUser} = require('../models/user-Schema');

const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
  const { error } = validateUser(req.body);
  if (error) return res.status(400).send(error.details[0].message);
  let user = await User.findOne({ username: req.body.username });
  if (user) return res.status(400).send('User with that username is already registered.');
  user = await User.findOne({ emailAddress: req.body.emailAddress });
  if (user) return res.status(400).send('User with that email address is already registered.');
  user = new User({
  username: req.body.username,
  password: req.body.password,
  emailAddress: req.body.emailAddress,
  aboutMe: "",
  birdCall: "",
  myBirds: [],
  birdsIWatch: [],
  friends: []
  });
  await user.save();
  return res.send({ username: user.username, emailAddress: user.emailAddress });
  } catch (ex) {
  return res.status(500).send(`Internal Server Error: ${ex}`);
  }
 });
 

module.exports = router;