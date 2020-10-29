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
router.post('/log-out', auth, async (req, res) => {
  try {
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        isOnline: false
      });
    user.save();
    return res.send( `User "${user.username}" logged out successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Get signed-in user's profile
router.get('/user-profile', auth, async (req, res) => {
  try {
  const userProfile = await User.findById( req.user._id, { password: 0, posts: 0, _id: 0, __v: 0 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to find the user's profile information: ${err}`);} );
  return res.send( userProfile ); //never change this line again

  } catch (ex) {
  return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Delete user account (after making very sure the user wants to permanently delete the account)
router.delete('/delete-account', auth, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.user._id);
    if (deletedUser) return res.send( `User "${deletedUser.username}" deleted successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Create a new post
router.post('/create-post', auth, async (req, res) => {
  try {
    let post = {
      author: req.user.username,
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
    return res.send( user.posts );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Edit a post by postId
router.put('/edit-post', auth, async (req, res) => {
  try {
    if (!req.body.postId) return res.status(400).send('postId must be supplied in the request body.');
    if (typeof req.body.postId !== "string") return res.status(400).send('The value of postId must be a string.');
    if (!req.body.newText && !req.body.newImageString) return res.status(400).send('newText and/or newImageString must be supplied in the request body.');
    if (req.body.newText) {
      if (typeof req.body.newText !== "string") return res.status(400).send('The value of newText must be a string.');
    }
    if (req.body.newImageString) {
      if (typeof req.body.newImageString !== "string") return res.status(400).send('The value of newImageString must be a string.');
    }

    const user = await User.findById(req.user._id);
    const postIndex = user.posts.findIndex((post) => post._id == req.body.postId);
    if (postIndex === -1) return res.status(400).send(`User "${req.user.username}" has no post to edit with _id "${req.body.postId}".`);
    if (req.body.newText) user.posts[postIndex].text = req.body.newText;
    if (req.body.newImageString) user.posts[postIndex].imageString = req.body.newImageString;
    user.posts[postIndex].updateTime = Date.now();
    user.save();
    return res.send( user.posts[postIndex] );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Like (or undo like) a post by postId
router.put('/like-post', auth, async (req, res) => {
  try {
    if (!req.body.postId) return res.status(400).send('postId must be supplied in the request body.');
    if (typeof req.body.postId !== "string") return res.status(400).send('The value of postId must be a string.');

    const author = await User.findOne( { "posts._id": req.body.postId }, function(err, results){ if (err) return res.status(404).send(`The post with _id ${req.body.postId} does not exist. Following is the error from MongoDB:\n${err}`);} );
    const postIndex = author.posts.findIndex((post) => post._id == req.body.postId);
    const userIndex = author.posts[postIndex].likes.indexOf(req.user.username);
    if (userIndex === -1) author.posts[postIndex].likes.push(req.user.username);
    else {
      author.posts[postIndex].likes.splice(userIndex, 1);
    }
    
    author.save();
    return res.send( author.posts[postIndex] );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Delete a post by postId
router.delete('/delete-post', auth, async (req, res) => {
  try {
    if (!req.body.postId) return res.status(400).send('postId must be supplied in the request body.');
    if (typeof req.body.postId !== "string") return res.status(400).send('The value of postId must be a string.');
    
    const user = await User.findById(req.user._id);
    const postIndex = user.posts.findIndex((post) => post._id == req.body.postId);
    if (postIndex === -1) return res.status(400).send(`User "${req.user.username}" has no post to delete with _id "${req.body.postId}".`);
    user.posts.splice(postIndex, 1);
    user.save();
    return res.send( `Post with _id ${req.body.postId} deleted successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Get all friends' and user's posts, sorted chronologically
router.get('/posts', auth, async (req, res) => {
  try {
  const friends = await User.find( { friends: req.user.username }, { _id: 0, posts: 1 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to find friends' posts: ${err}`);} );
  if (!friends) return res.send(`The user does not yet have friends from whom to get posts.`);
  const user = await User.findById( req.user._id, { _id: 0, posts: 1 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to find the user's posts: ${err}`);} );

  let postsToDisplay = [];
  for (let i = 0; i < friends.length; i++){
    for (let j = 0; j < friends[i].posts.length; j++){
      postsToDisplay.push(friends[i].posts[j]);
    }
  }
  for (let i = 0; i < user.posts.length; i++){ postsToDisplay.push(user.posts[i]); }
  postsToDisplay.sort((a, b) => b.postTime - a.postTime);
  
  return res.send( { postsToDisplay: postsToDisplay } );

  } catch (ex) {
  return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Get profile information of all friends
router.get('/all-friends-profiles', auth, async (req, res) => {
  try {
  const friends = await User.find( { friends: req.user.username }, { password: 0, posts: 0, incomingFriendRequests: 0, outgoingFriendRequests: 0, _id: 0, __v: 0 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to find friends' profile information: ${err}`);} );
  if (!friends) return res.send(`The user does not yet have friends from whom to get profile information.`);
  let allFriendsProfiles = [];
  for (let i = 0; i < friends.length; i++){
    allFriendsProfiles.push(friends[i]);
  }
  return res.send( { allFriendsProfiles: allFriendsProfiles } );
  } catch (ex) {
  return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Request a new friend by either username or email address
router.put('/request-friend', auth, async (req, res) => {
  try {
    let possibleFriend = await User.findOne({ $or: [ { username: req.body.usernameOrEmailAddress }, { emailAddress: req.body.usernameOrEmailAddress } ] });

    if (!possibleFriend) return res.status(404).send('There is no registered user with that username or email address.\nNote: Registered Squawk usernames and email addresses are case-sensitive.');
    else if (possibleFriend.username == req.user.username) return res.status(403).send(`You can't request yourself as a friend!`);
    else if (possibleFriend.friends.includes(req.user.username)) return res.status(403).send(`You cannot request ${possibleFriend.username} as a friend, because ${possibleFriend.username} is already your friend!`);
    else if (possibleFriend.incomingFriendRequests.includes(req.user.username)) return res.status(403).send(`You have already asked ${possibleFriend.username} to be your friend!`);
    else if (possibleFriend.outgoingFriendRequests.includes(req.user.username)){
      const newFriend = await User.findByIdAndUpdate(possibleFriend._id,
        {
          $pullAll: { outgoingFriendRequests: [req.user.username] },
          $pullAll: { incomingFriendRequests: [req.user.username] },
          $push: { friends: req.user.username }
        });
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [possibleFriend.username] },
          $pullAll: { incomingFriendRequests: [possibleFriend.username] },
          $push: { friends: possibleFriend.username }
        },
        {new: true});
      newFriend.save();
      user.save();
      return res.send({ status: `${possibleFriend.username} had already requested you as a friend, so you are now friends!`, outgoingFriendRequests: user.outgoingFriendRequests });
    }
    else {
      const requestedFriend = await User.findByIdAndUpdate(possibleFriend._id,
        {
          $push: { incomingFriendRequests: req.user.username }
        });
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $push: { outgoingFriendRequests: requestedFriend.username }
        },
        {new: true});
      requestedFriend.save();
      user.save();
      return res.send({ status: `Friend request successfully sent to user ${requestedFriend.username}.`, outgoingFriendRequests: user.outgoingFriendRequests });
    }
  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Cancel pending outgoing friend request
router.put('/cancel-friend-request', auth, async (req, res) => {
  try {
    let possibleUnRequestedFriend = await User.findOne({ username: req.body.username });

    if (!possibleUnRequestedFriend) {
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] },
          $pullAll: { incomingFriendRequests: [req.body.username] },
          $pullAll: { friends: [req.body.username] }
        },
        {new: true});
      user.save();
      return res.status(404).send('There is no registered user with that username.\nNote: Registered Squawk usernames are case-sensitive.');
    }
    else if (possibleUnRequestedFriend.username == req.user.username) return res.status(403).send(`You can't request yourself as a friend, so you can't cancel a request of yourself!`);
    else if (possibleUnRequestedFriend.friends.includes(req.user.username)) return res.status(403).send(`${possibleUnRequestedFriend.username} is already your friend, so you can't cancel a friend request made to ${possibleUnRequestedFriend.username}.`);
    else if (!possibleUnRequestedFriend.incomingFriendRequests.includes(req.user.username)) return res.status(403).send(`You can't cancel a request that doesn't exist.\nThere does not exist a request from you to add ${possibleUnRequestedFriend.username} as a friend.`);
    else if (possibleUnRequestedFriend.outgoingFriendRequests.includes(req.user.username)) return res.status(403).send(`${possibleUnRequestedFriend.username} has already sent you a friend request. Try declining that instead.`);
    else {
      const unRequestedFriend = await User.findByIdAndUpdate(possibleUnRequestedFriend._id,
        {
          $pullAll: { incomingFriendRequests: [req.user.username] }
        });
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] }
        },
        {new: true});
      unRequestedFriend.save();
      user.save();
      return res.send({ status: `Friend request to user ${unRequestedFriend.username} cancelled successfully.`, outgoingFriendRequests: user.outgoingFriendRequests });
    }
  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Accept incoming friend request
router.put('/accept-friend-request', auth, async (req, res) => {
  try {
    let newFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pullAll: { outgoingFriendRequests: [req.user.username] },
        $push: { friends: req.user.username }
      });
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $pullAll: { incomingFriendRequests: [req.body.username] }
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

//Decline incoming friend request
router.put('/decline-friend-request', auth, async (req, res) => {
  try {
    let notFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pullAll: { outgoingFriendRequests: [req.user.username] }
      });
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $pullAll: { incomingFriendRequests: [req.body.username] }
      },
      {new: true});
    if (notFriend) notFriend.save();
    user.save();

    return res.send({ incomingFriendRequests: user.incomingFriendRequests });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Remove friend
router.put('/remove-friend', auth, async (req, res) => {
  try {
    let exFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pullAll: { friends: [req.user.username] }
      });
    let user = await User.findByIdAndUpdate(req.user._id,
      {
        $pullAll: { friends: [req.body.username] }
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
  if (friends === []) return res.send(`The user does not yet have friends from whom to get online statuses.`);
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
  const usernameTaken = await User.findOne({ username: req.body.username });
  if (usernameTaken) return res.status(400).send('Someone is already registered with that username.');
  
  const user = await User.findByIdAndUpdate(req.user._id,
    { username: req.body.username },
    { new: true }
    );
  user.save();
  
  return res.send({ username: user.username });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update password
router.put('/update-password', auth, async (req, res) => {
  try {
  const salt = await bcrypt.genSalt(10);
  const user = await User.findByIdAndUpdate(req.user._id,
    { password: await bcrypt.hash(req.body.password, salt) },
    { new: true }
    );
  user.save();

  return res.send( `User "${user.username}" password updated successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update emailAddress
router.put('/update-email-address', auth, async (req, res) => {
  try {
  const emailAddressTaken = await User.findOne({ emailAddress: req.body.emailAddress });
  if (emailAddressTaken) return res.status(400).send('Someone is already registered with that email address.');

  const user = await User.findByIdAndUpdate(req.user._id,
    { emailAddress: req.body.emailAddress },
    { new: true }
    );
  user.save();

  return res.send({ emailAddress: user.emailAddress });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update profilePicture
router.put('/update-profile-picture', auth, async (req, res) => {
  try {
  const user = await User.findByIdAndUpdate(req.user._id,
    { profilePicture: req.body.profilePicture },
    { new: true }
    );
  user.save();

  return res.send({ profilePicture: user.profilePicture });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update aboutMe
router.put('/update-about-me', auth, async (req, res) => {
  try {
  const user = await User.findByIdAndUpdate(req.user._id,
    { aboutMe: req.body.aboutMe },
    { new: true }
    );
  user.save();

  return res.send({ aboutMe: user.aboutMe });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update birdCall
router.put('/update-bird-call', auth, async (req, res) => {
  try {
  const user = await User.findByIdAndUpdate(req.user._id,
    { birdCall: req.body.birdCall },
    { new: true }
    );
  user.save();

  return res.send({ birdCall: user.birdCall });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update myBirds
router.put('/update-my-birds', auth, async (req, res) => {
  try {
  const user = await User.findByIdAndUpdate(req.user._id,
    { myBirds: req.body.myBirds },
    { new: true }
    );
  user.save();

  return res.send({ myBirds: user.myBirds });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update birdsIWatch
router.put('/update-birds-i-watch', auth, async (req, res) => {
  try {
  const user = await User.findByIdAndUpdate(req.user._id,
    { birdsIWatch: req.body.birdsIWatch },
    { new: true }
    );
  user.save();

  return res.send({ birdsIWatch: user.birdsIWatch });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

module.exports = router;