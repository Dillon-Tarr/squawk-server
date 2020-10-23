const { User, validateUser } = require('../models/user');

const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const express = require('express');
const router = express.Router();

//Create new user
router.post('/', async (req, res) => {
  try {
    const { error } = validateUser(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    var user = await User.findOne({ username: req.body.username });
    if (user) return res.status(400).send('User with that username is already registered.');
    user = await User.findOne({ emailAddress: req.body.emailAddress });
    if (user) return res.status(400).send('User with that email address is already registered.');

    const salt = await bcrypt.genSalt(10);
    user = new User({
      username: req.body.username,
      password: await bcrypt.hash(req.body.password, salt),
      emailAddress: req.body.emailAddress,
      isOnline: true,
      profilePicture: "",
      aboutMe: "",
      birdCall: "",
      myBirds: [],
      birdsIWatch: [],
      friends: [],
      incomingFriendRequests: [],
      outgoingFriendRequests: [],
      posts: []
    });
    await user.save();

    const token = user.generateAuthToken();
    
    return res
      .header('x-auth-token', token)
      .header('access-control-expose-headers', 'x-auth-token')
      .send({ _id: user._id, username: user.username, emailAddress: user.emailAddress, isOnline: user.isOnline, profilePicture: user.profilePicture, aboutMe: user.aboutMe, birdCall: user.birdCall, myBirds: user.myBirds, birdsIWatch: user.birdsIWatch, friends: user.friends, incomingFriendRequests: user.incomingFriendRequests, outgoingFriendRequests: user.outgoingFriendRequests, posts: user.posts });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Request a new friend by either username or email address and respond with updated outgoing friend requests
router.put('/:_id/request-friend', auth, async (req, res) => {
  try {
    let requestedFriend = await User.findOneAndUpdate(
      { $or: [ { username: req.body.usernameOrEmailAddress }, { emailAddress: req.body.usernameOrEmailAddress } ] },
      {
        $push: { incomingFriendRequests: req.user.username }
      });
    if (!requestedFriend) return res.status(404).send('There is no registered user with that username/email address.');
    requestedFriend.save();
    let user = User.findByIdAndUpdate(req.params._id,
      {
        $push: { outgoingFriendRequests: requestedFriend.username }
      },
      {new: true});
    await user.save();
    return res.send({ outgoingFriendRequests: user.outgoingFriendRequests });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Cancel pending outgoing friend request and respond with updated outgoing friend requests
router.put('/:_id/cancel-friend-request', auth, async (req, res) => {
  try {
    let unRequestedFriend = await User.findOneAndUpdate(
      { $or: [ { username: req.body.usernameOrEmailAddress }, { emailAddress: req.body.usernameOrEmailAddress } ] },
      {
        $pull: { incomingFriendRequests: req.user.username }
      });
    if (unRequestedFriend) unRequestedFriend.save();
    let user = User.findByIdAndUpdate(req.params._id,
      {
        $pull: { outgoingFriendRequests: unRequestedFriend.username }
      },
      {new: true});
    await user.save();
    return res.send({ outgoingFriendRequests: user.outgoingFriendRequests });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Accept incoming friend request and respond with updated incoming friend requests and updated friends
router.put('/:_id/accept-friend-request', auth, async (req, res) => {
  try {
    let newFriend = await User.findOneAndUpdate(
      { $or: [ { username: req.body.usernameOrEmailAddress }, { emailAddress: req.body.usernameOrEmailAddress } ] },
      {
        $pull: { outgoingFriendRequests: req.user.username }
      });
    let user = await User.findByIdAndUpdate(req.params._id,
      {
        $pull: { incomingFriendRequests: req.body.usernameOrEmailAddress }
      },
      {new: true});
    user.save();
    if (!newFriend) return res.status(404).send('The user whose friend request you accepted is no longer registered.');
    user.friends.push(newFriend.username);
    newFriend.save();
    user.save();
    return res.send({ incomingFriendRequests: user.incomingFriendRequests, friends: user.friends });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Decline incoming friend request and respond with updated incoming friend requests
router.put('/:_id/decline-friend-request', auth, async (req, res) => {
  try {
    let notFriend = await User.findOneAndUpdate(
      { $or: [ { username: req.body.usernameOrEmailAddress }, { emailAddress: req.body.usernameOrEmailAddress } ] },
      {
        $pull: { outgoingFriendRequests: req.user.username }
      });
    let user = await User.findByIdAndUpdate(req.params._id,
      {
        $pull: { incomingFriendRequests: req.body.usernameOrEmailAddress }
      },
      {new: true});
    if (notFriend) notFriend.save();
    user.save();

    return res.send({ incomingFriendRequests: user.incomingFriendRequests });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Get the online status of all friends
router.get('/:_id/online-friends', auth, async (req, res) => {
  try {
  const user = User.findOneById(req.params._id);
  const friends = await user.friends;
  let friendsAndOnlineStatuses = [];
  for(let i = 0; i < friends.length; i++){
    let friend = User.findOne({ username: friends[i].username });
    friendsAndOnlineStatuses.push({
      username: friend.username,
      isOnline: friend.isOnline
    });
  }
  return res.send({ friendsAndOnlineStatuses });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

module.exports = router;