const { User, validateUser } = require('../models/user');

const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const express = require('express');
const router = express.Router();

//Create new user
//VERIFIED WORKING
router.post('/', async (req, res) => {
  try {
    const { error } = validateUser(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let user = await User.findOne({ username: req.body.username });
    if (user) return res.status(400).send('Someone is already registered with that username.');
    user = await User.findOne({ emailAddress: req.body.emailAddress });
    if (user) return res.status(400).send('Someone is already registered with that email address.');

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

//Log out
//VERIFIED WORKING
router.put('/log-out', auth, async (req, res) => {
  try {
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        isOnline: false
      });
    user.save();
    res.send( `User "${user.username}" logged out successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Get signed-in user's info
//VERIFIED WORKING
router.get('/user-info', auth, async (req, res) => {
  try {
  const user = await User.findById(req.user._id);
  let userSinPassword = {...user._doc};
  userSinPassword.password = "Haha, you no see.";
  return res.send(userSinPassword);
  } catch (ex) {
  return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Delete user account (after making very sure the user wants to permanently delete the account)
//VERIFIED WORKING
router.delete('/delete-account', auth, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.user._id);
    if (deletedUser) return res.send( `User "${deletedUser.username}" deleted successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Create a new post
//VERIFIED WORKING
router.post('/create-post', auth, async (req, res) => {
  try {
    let post = {
      author: req.user.username,
      postTime: Date.now(),
      text: req.body.text,
      imageString: req.body.imageString,
      likes: []
    }
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $push: { posts: post }
      },
      { new: true });
    user.save();
    res.send( user.posts );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Edit a post by index (postIndex must be a STRING)
//VERIFIED WORKING
router.put('/edit-post', auth, async (req, res) => {
  try {
    if (!req.body.postIndex) return res.status(400).send('The HTTP request submitted had no value included for postIndex, or the value supplied equated to null -- e.g. the number 0');
    if (typeof req.body.postIndex !== "string") return res.status(400).send('The value of postIndex must be a string, the reason being that "postIndex": 0 is considered null.');
    if (!req.body.newText && !req.body.newImageString) return res.status(400).send('newText and/or newImageString must be supplied in the request body.');
    if (req.body.newText) {
      if (typeof req.body.newText !== "string") return res.status(400).send('The value of newText must be a string.');
    }
    if (req.body.newImageString) {
      if (typeof req.body.newImageString !== "string") return res.status(400).send('The value of newImageString must be a string.');
    }

    let postIndex = parseInt(req.body.postIndex);
    if (postIndex < 0) return res.status(400).send(`${req.body.postIndex} is not a valid index.`);
    let user = await User.findById(req.user._id);
    if (postIndex + 1 > user.posts.length) return res.status(400).send(`There is no existing post at index ${req.body.postIndex} of user.posts`);

    let postsCopy = [...user.posts];
    let updatedPost = postsCopy.splice(postIndex, 1);
    updatedPost = updatedPost[0];
    if (req.body.newText) updatedPost.text = req.body.newText;
    if (req.body.newImageString) updatedPost.imageString = req.body.newImageString;
    updatedPost.updateTime = Date.now();

    user.posts.splice(postIndex, 1, updatedPost);
    user.save();
    res.send( user.posts );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Like a post by author and index (postIndex must be a STRING)
//VERIFIED WORKING
router.put('/like-post', auth, async (req, res) => {
  try {
    if (!req.body.author) return res.status(400).send('author must be supplied in the request body.');
    if (typeof req.body.author !== "string") return res.status(400).send('The value of author must be a string.');
    if (!req.body.postIndex) return res.status(400).send('The HTTP request submitted had no value included for postIndex, or the value supplied equated to null -- e.g. the number 0');
    if (typeof req.body.postIndex !== "string") return res.status(400).send('The value of postIndex must be a string, the reason being that "postIndex": 0 is considered null.');

    let postIndex = parseInt(req.body.postIndex);
    if (postIndex < 0) return res.status(400).send(`${req.body.postIndex} is not a valid index.`);
    let author = await User.findOne( { username: req.body.author } );
    if (!author) return res.status(400).send(`There is no user with username ${req.body.author}.`);
    if (postIndex + 1 > author.posts.length) return res.status(400).send(`There is no existing post at index ${req.body.postIndex} of ${req.body.author}.posts`);

    let postsCopy = [...author.posts];
    let updatedPost = postsCopy.splice(postIndex, 1);
    updatedPost = updatedPost[0];

    let indexOfUser = updatedPost.likes.indexOf(req.user.username);
    if (indexOfUser === -1) updatedPost.likes.push(req.user.username);
    else {
      updatedPost.likes.splice(indexOfUser, 1);
    }

    author.posts.splice(postIndex, 1, updatedPost);
    author.save();
    res.send( author.posts[postIndex] );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Delete a post by index (postIndex must be a STRING)
//VERIFIED WORKING
router.delete('/delete-post', auth, async (req, res) => {
  try {
    if (!req.body.postIndex) return res.status(400).send('The HTTP request submitted had no value included for postIndex, or the value supplied equated to null -- e.g. the number 0');
    if (typeof req.body.postIndex !== "string") return res.status(400).send('The value of postIndex must be a string, the reason being that "postIndex": 0 is considered null.');
    
    let postIndex = parseInt(req.body.postIndex);
    if (postIndex < 0) return res.status(400).send(`${req.body.postIndex} is not a valid index.`);
    let user = await User.findById(req.user._id);
    if (postIndex + 1 > user.posts.length) return res.status(400).send(`There is no existing post at index ${req.body.postIndex} of user.posts`);
    user.posts.splice(postIndex, 1);
    user.save();
    res.send( user.posts );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Get all friends' posts
//VERIFIED WORKING
router.get('/all-friends-posts', auth, async (req, res) => {
  try {
  const friends = await User.find( { friends: req.user.username } );
  let allFriendsPosts = [];
  for (let i = 0; i < friends.length; i++){
    for (let j = 0; j < friends[i].posts.length; j++){
      allFriendsPosts.push(friends[i].posts[j]);
    }
  }
  return res.send( allFriendsPosts );
  } catch (ex) {
  return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Request a new friend by either username or email address and respond with updated outgoing friend requests
//VERIFIED WORKING
router.put('/request-friend', auth, async (req, res) => {
  try {
    let requestedFriend = await User.findOneAndUpdate(
      { $or: [ { username: req.body.usernameOrEmailAddress }, { emailAddress: req.body.usernameOrEmailAddress } ] },
      {
        $push: { incomingFriendRequests: req.user.username }
      });
    if (!requestedFriend) return res.status(404).send('There is no registered user with that username/email address.');
    requestedFriend.save();
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $push: { outgoingFriendRequests: requestedFriend.username }
      },
      {new: true});
    user.save();
    return res.send({ outgoingFriendRequests: user.outgoingFriendRequests });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Cancel pending outgoing friend request and respond with updated outgoing friend requests
//VERIFIED WORKING
router.put('/cancel-friend-request', auth, async (req, res) => {
  try {
    let unRequestedFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pull: { incomingFriendRequests: req.user.username }
      });
    if (unRequestedFriend) unRequestedFriend.save();
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $pull: { outgoingFriendRequests: req.body.username }
      },
      {new: true});
    user.save();
    return res.send({ outgoingFriendRequests: user.outgoingFriendRequests });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Accept incoming friend request and respond with updated incoming friend requests and updated friends
//VERIFIED WORKING
router.put('/accept-friend-request', auth, async (req, res) => {
  try {
    let newFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pull: { outgoingFriendRequests: req.user.username },
        $push: { friends: req.user.username }
      });
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $pull: { incomingFriendRequests: req.body.username }
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
//VERIFIED WORKING
router.put('/decline-friend-request', auth, async (req, res) => {
  try {
    let notFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pull: { outgoingFriendRequests: req.user.username }
      });
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $pull: { incomingFriendRequests: req.body.username }
      },
      {new: true});
    if (notFriend) notFriend.save();
    user.save();

    return res.send({ incomingFriendRequests: user.incomingFriendRequests });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Remove friend and respond with updated friends
//VERIFIED WORKING
router.put('/remove-friend', auth, async (req, res) => {
  try {
    let exFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pull: { friends: req.user.username }
      });
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $pull: { friends: req.body.username }
      },
      {new: true});
    if (exFriend) exFriend.save();
    user.save();

    return res.send({ friends: user.friends });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Get the online status of all friends
router.get('/online-friends', auth, async (req, res) => {
  try {
  const user = await User.findById(req.user._id);
  const friends = user.friends;
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

//Update username
router.put('/update-username', auth, async (req, res) => {
  try {
  let usernameTaken = await User.findOne({ username: req.body.username });
  if (usernameTaken) return res.status(400).send('Someone is already registered with that username.');
  
  let user = await User.findByIdAndUpdate(req.user._id,
    { username: req.body.username },
    { new: true }
    );

  return res.send({ username: user.username });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update password
router.put('/update-password', auth, async (req, res) => {
  try {
  const salt = await bcrypt.genSalt(10);
  let user = await User.findByIdAndUpdate(req.user._id,
    { password: await bcrypt.hash(req.body.password, salt) },
    { new: true }
    );

  return res.send( `User "${user.username}" password updated successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update emailAddress
router.put('/update-email-address', auth, async (req, res) => {
  try {
  let emailAddressTaken = await User.findOne({ emailAddress: req.body.emailAddress });
  if (emailAddressTaken) return res.status(400).send('Someone is already registered with that email address.');

  let user = await User.findByIdAndUpdate(req.user._id,
    { emailAddress: req.body.emailAddress },
    { new: true }
    );

  return res.send({ emailAddress: user.emailAddress });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update profilePicture
router.put('/update-profile-picture', auth, async (req, res) => {
  try {
  let user = await User.findByIdAndUpdate(req.user._id,
    { profilePicture: req.body.profilePicture },
    { new: true }
    );

  return res.send({ profilePicture: user.profilePicture });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update aboutMe
router.put('/update-about-me', auth, async (req, res) => {
  try {
  let user = await User.findByIdAndUpdate(req.user._id,
    { aboutMe: req.body.aboutMe },
    { new: true }
    );

  return res.send({ aboutMe: user.aboutMe });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update birdCall
router.put('/update-bird-call', auth, async (req, res) => {
  try {
  let user = await User.findByIdAndUpdate(req.user._id,
    { birdCall: req.body.birdCall },
    { new: true }
    );

  return res.send({ birdCall: user.birdCall });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update myBirds
router.put('/update-my-birds', auth, async (req, res) => {
  try {
  let user = await User.findByIdAndUpdate(req.user._id,
    { myBirds: req.body.myBirds },
    { new: true }
    );

  return res.send({ myBirds: user.myBirds });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update birdsIWatch
router.put('/update-birds-i-watch', auth, async (req, res) => {
  try {
  let user = await User.findByIdAndUpdate(req.user._id,
    { birdsIWatch: req.body.birdsIWatch },
    { new: true }
    );

  return res.send({ birdsIWatch: user.birdsIWatch });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

module.exports = router;