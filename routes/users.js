const { User, validateUser } = require('../models/user');
const { BlacklistedToken } = require('../models/blacklistedToken');

const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const checkTokenBlacklist = require('../middleware/checkTokenBlacklist');
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
    const user = await User.findByIdAndUpdate(req.user._id,
      {
        isOnline: false
      });
    user.save();

    const oldToken = req.header('x-auth-token');
    const blacklistedToken = new BlacklistedToken({
      string: oldToken
    });
    await blacklistedToken.save();
    
    return res.send( `User "${user.username}" logged out successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Get signed-in user's profile
router.get('/user-profile', auth, checkTokenBlacklist, async (req, res) => {
  try {
  const userProfile = await User.findById( req.user._id, { password: 0, posts: 0, _id: 0, __v: 0 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to find the user's profile information: ${err}`);} );
  return res.send( userProfile ); //never change this line again

  } catch (ex) {
  return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Delete user account (after making very sure the user wants to permanently delete the account)
router.delete('/delete-account', auth, checkTokenBlacklist, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.user._id);
    if (!deletedUser) return res.send( `User "${deletedUser.username}" not found.` );

    const currentFriends = await User.find( { friends: req.user.username }, { _id: 1 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to update ${req.user.username}'s username: ${err}`);} );
    if (currentFriends) {
      for (let i = 0; i < currentFriends.length; i++){
        const friend = await User.findByIdAndUpdate(currentFriends[i]._id,
          {
            $pullAll: { friends: [req.user.username] },
          });
        friend.save();
      }
    }
    const wannabeFriends = await User.find( { outgoingFriendRequests: req.user.username }, { _id: 1 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to update ${req.user.username}: ${err}`);} );
    if (wannabeFriends) {
      for (let i = 0; i < wannabeFriends.length; i++){
        const wannabeFriend = await User.findByIdAndUpdate(wannabeFriends[i]._id,
          {
            $pullAll: { outgoingFriendRequests: [req.user.username] },
          });
        wannabeFriend.save();
      }
    }
    const friendMeMaybes = await User.find( { incomingFriendRequests: req.user.username }, { _id: 1 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to update ${req.user.username}: ${err}`);} );
    if (friendMeMaybes) {
      for (let i = 0; i < friendMeMaybes.length; i++){
        const friendMeMaybe = await User.findByIdAndUpdate(friendMeMaybes[i]._id,
          {
            $pullAll: { incomingFriendRequests: [req.user.username] },
          });
        friendMeMaybe.save();
      }
    }
  
    const oldToken = req.header('x-auth-token');
    const blacklistedToken = new BlacklistedToken({
      string: oldToken
    });
    await blacklistedToken.save();
    
    return res.send( `User "${deletedUser.username}" deleted successfully.` );

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Create a new post
router.post('/create-post', auth, checkTokenBlacklist, async (req, res) => {
  try {
    const post = {
      author: req.user.username,
      text: req.body.text,
      imageString: req.body.imageString,
      likes: []
    }
    const user = await User.findByIdAndUpdate(req.user._id,
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
router.put('/edit-post', auth, checkTokenBlacklist, async (req, res) => {
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
router.put('/like-post', auth, checkTokenBlacklist, async (req, res) => {
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
router.delete('/delete-post', auth, checkTokenBlacklist, async (req, res) => {
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
router.get('/posts', auth, checkTokenBlacklist, async (req, res) => {
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
router.get('/all-friends-profiles', auth, checkTokenBlacklist, async (req, res) => {
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
router.put('/request-friend', auth, checkTokenBlacklist, async (req, res) => {
  try {
    const possibleFriend = await User.findOne({ $or: [ { username: req.body.usernameOrEmailAddress }, { emailAddress: req.body.usernameOrEmailAddress } ] });

    if (!possibleFriend) var noUser = true;
    else if (possibleFriend.username == req.user.username) var requestedSelf = true;
    else if (possibleFriend.friends.includes(req.user.username)) var alreadyFriends = true;
    else if (possibleFriend.incomingFriendRequests.includes(req.user.username)) var alreadyRequested = true;
    else if (possibleFriend.outgoingFriendRequests.includes(req.user.username)) var mutuallyRequested = true;

    if (noUser || requestedSelf) {
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] },
          $pullAll: { incomingFriendRequests: [req.body.username] },
          $pullAll: { friends: [req.body.username] }
        },
        {new: true});
      user.save();
      if (noUser) return res.status(404).send('There is no registered user with that username or email address.\nNote: Registered Squawk usernames and email addresses are case-sensitive.');
      return res.status(403).send(`You can't request yourself as a friend!`);
    }
    else if (alreadyFriends) return res.status(403).send(`You cannot request ${possibleFriend.username} as a friend, because ${possibleFriend.username} is already your friend!`);
    else if (alreadyRequested) return res.status(403).send(`You have already asked ${possibleFriend.username} to be your friend!`);
    else if (mutuallyRequested){
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
router.put('/cancel-friend-request', auth, checkTokenBlacklist, async (req, res) => {
  try {
    const possibleUnRequestedFriend = await User.findOne({ username: req.body.username });

    if (!possibleUnRequestedFriend) var noUser = true;
    else if (possibleUnRequestedFriend.username == req.user.username) var cancelledSelf = true;
    else if (possibleUnRequestedFriend.friends.includes(req.user.username)) var alreadyFriends = true;
    else if (possibleUnRequestedFriend.incomingFriendRequests.includes(req.user.username)) var noRequestToCancel = true;
    else if (possibleUnRequestedFriend.outgoingFriendRequests.includes(req.user.username)) var shouldDeclineInstead = true;

    if (noUser || cancelledSelf) {
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] },
          $pullAll: { incomingFriendRequests: [req.body.username] },
          $pullAll: { friends: [req.body.username] }
        },
        {new: true});
      user.save();
      if (noUser) return res.status(404).send('There is no registered user with that username.\nNote: Registered Squawk usernames are case-sensitive.');
      return res.status(403).send(`You can't request yourself as a friend, so you can't cancel a request of yourself!`);
    }
    else if (alreadyFriends) {
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] },
          $pullAll: { incomingFriendRequests: [req.body.username] },
        },
        {new: true});
      user.save();
      return res.status(403).send(`${req.body.username} is already your friend!`);
    }
    else if (noRequestToCancel) {
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] }
        },
        {new: true});
      user.save();
      return res.status(404).send(`You can't cancel a request that doesn't exist.\nThere does not exist a request from you to add ${req.body.username} as a friend.`);
    }
    else if (shouldDeclineInstead) return res.status(403).send(`${req.body.username} has already sent you a friend request. Try declining the incoming request instead.`);
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
      return res.send({ status: `Friend request to user ${req.body.username} cancelled successfully.`, outgoingFriendRequests: user.outgoingFriendRequests });
    }
  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Accept incoming friend request
router.put('/accept-friend-request', auth, checkTokenBlacklist, async (req, res) => {
  try {
    const possibleNewFriend = await User.findOne({ username: req.body.username });

    if (!possibleNewFriend) var noUser = true;
    else if (possibleNewFriend.username == req.user.username) var acceptedSelf = true;
    else if (possibleNewFriend.friends.includes(req.user.username)) var alreadyFriends = true;
    else if (!possibleNewFriend.outgoingFriendRequests.includes(req.user.username)) var noRequestToAccept = true;

    if (noUser || acceptedSelf){
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] },
          $pullAll: { incomingFriendRequests: [req.body.username] },
          $pullAll: { friends: [req.body.username] }
        },
        {new: true});
      user.save();
      if (noUser) return res.status(404).send('The user whose friend request you accepted is no longer registered.');
      else if (acceptedSelf) return res.status(403).send(`You can't request yourself as a friend, so you can't accept a request from yourself!`);
    }
    else if (alreadyFriends || noRequestToAccept){
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] },
          $pullAll: { incomingFriendRequests: [req.body.username] },
        },
        {new: true});
      user.save();
      if (alreadyFriends) return res.status(403).send(`${req.body.username} is already your friend! :D`);
      return res.status(403).send(`You can't accept a request that doesn't exist.\nThere does not exist a request from ${req.body.username} to add you as a friend.\n${req.body.username} may have cancelled the request.`);
    }
    else {
      const newFriend = await User.findByIdAndUpdate(possibleFriend._id,
        {
          $pullAll: { outgoingFriendRequests: [req.user.username] },
          $pullAll: { incomingFriendRequests: [req.user.username] },
          $push: { friends: req.user.username }
        });
      const user = await User.findByIdAndUpdate(req.user._id,
        {
          $pullAll: { outgoingFriendRequests: [req.body.username] },
          $pullAll: { incomingFriendRequests: [req.body.username] },
          $push: { friends: req.body.username }
        },
        {new: true});
      newFriend.save();
      user.save();
      return res.send({ status: `Friend request from ${req.body.username} accepted successfully. You and ${req.body.username} are now friends!`, incomingFriendRequests: user.incomingFriendRequests, friends: user.friends });
    }
  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Decline incoming friend request
router.put('/decline-friend-request', auth, checkTokenBlacklist, async (req, res) => {
  try {
    if (req.body.username == req.user.username) return res.status(403).send(`You can't request yourself as a friend, so you can't decline a request from yourself!`);
    const notFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pullAll: { outgoingFriendRequests: [req.user.username] }
      });
    const user = await User.findByIdAndUpdate(req.user._id,
      {
        $pullAll: { incomingFriendRequests: [req.body.username] }
      },
      {new: true});
    if (notFriend) notFriend.save();
    user.save();
    if (notFriend.friends.includes(req.user.username)) return res.send(`${req.body.username} is in your friends list. Use the remove option if you want to change that.`);
    return res.send({ incomingFriendRequests: user.incomingFriendRequests });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Remove friend
router.put('/remove-friend', auth, checkTokenBlacklist, async (req, res) => {
  try {
    if (req.body.username == req.user.username) return res.status(403).send(`You can't make it onto your own friends list, so you can't remove yourself from it either.`);
    const exFriend = await User.findOneAndUpdate(
      { username: req.body.username },
      {
        $pullAll: { outgoingFriendRequests: [req.user.username] },
        $pullAll: { incomingFriendRequests: [req.user.username] },
        $pullAll: { friends: [req.user.username] }
      });
    const user = await User.findByIdAndUpdate(req.user._id,
      {
        $pullAll: { outgoingFriendRequests: [req.body.username] },
        $pullAll: { incomingFriendRequests: [req.body.username] },
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
router.get('/online-friends', auth, checkTokenBlacklist, async (req, res) => {
  try {
  const user = await User.findById(req.user._id);
  const friends = user.friends;
  if (friends === []) return res.send(`The user does not yet have friends from whom to get online statuses.`);
  let friendsAndOnlineStatuses = [];
  for(let i = 0; i < friends.length; i++){
    const friend = User.findOne({ username: friends[i].username });
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
router.put('/update-username', auth, checkTokenBlacklist, async (req, res) => {
  try {
  const usernameTaken = await User.findOne({ username: req.body.username });
  if (usernameTaken) return res.status(400).send('Someone is already registered with that username.');
  
  const user = await User.findByIdAndUpdate(req.user._id,
    { username: req.body.username },
    { new: true }
    );
  for (let i = 0; i < user.posts.length; i++){
    user.posts[i].author = req.body.username;
  }
  user.save();
  
  const currentFriends = await User.find( { friends: req.user.username }, { _id: 1 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to update ${req.user.username}'s username: ${err}`);} );
  if (currentFriends) {
    for (let i = 0; i < currentFriends.length; i++){
      const friend = await User.findByIdAndUpdate(currentFriends[i]._id,
        {
          $pullAll: { friends: [req.user.username] },
        });
      friend.save();
    }
    for (let i = 0; i < currentFriends.length; i++){
      const friend = await User.findByIdAndUpdate(currentFriends[i]._id,
        {
          $push: { friends: req.body.username }
        });
      friend.save();
    }
  }
  const wannabeFriends = await User.find( { outgoingFriendRequests: req.user.username }, { _id: 1 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to update ${req.user.username}: ${err}`);} );
  if (wannabeFriends) {
    for (let i = 0; i < wannabeFriends.length; i++){
      const wannabeFriend = await User.findByIdAndUpdate(wannabeFriends[i]._id,
        {
          $pullAll: { outgoingFriendRequests: [req.user.username] },
        });
      wannabeFriend.save();
    }
    for (let i = 0; i < wannabeFriends.length; i++){
      const wannabeFriend = await User.findByIdAndUpdate(wannabeFriends[i]._id,
        {
          $push: { outgoingFriendRequests: req.body.username }
        });
      wannabeFriend.save();
    }
  }
  const friendMeMaybes = await User.find( { incomingFriendRequests: req.user.username }, { _id: 1 }, function(err, results){ if (err) return res.status(404).send(`The following error occurred when trying to update ${req.user.username}: ${err}`);} );
  if (friendMeMaybes) {
    for (let i = 0; i < friendMeMaybes.length; i++){
      const friendMeMaybe = await User.findByIdAndUpdate(friendMeMaybes[i]._id,
        {
          $pullAll: { incomingFriendRequests: [req.user.username] },
        });
      friendMeMaybe.save();
    }
    for (let i = 0; i < friendMeMaybes.length; i++){
      const friendMeMaybe = await User.findByIdAndUpdate(friendMeMaybes[i]._id,
        {
          $push: { incomingFriendRequests: req.body.username }
        });
      friendMeMaybe.save();
    }
  }

  const oldToken = req.header('x-auth-token');
  const blacklistedToken = new BlacklistedToken({
    string: oldToken
  });
  await blacklistedToken.save();

  const newToken = user.generateAuthToken();
  
  return res
    .header('x-auth-token', newToken)
    .header('access-control-expose-headers', 'x-auth-token')
    .send({ status: `Username updated successfully. NOTE: You must must replace the existing JWT with the new token from the x-auth-token header of this response. The token used to place this request will not be accepted again, except to log out.`, newUsername: user.username });

  } catch (ex) {
    return res.status(500).send(`Internal Server Error: ${ex}`);
  }
});

//Update password
router.put('/update-password', auth, checkTokenBlacklist, async (req, res) => {
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
router.put('/update-email-address', auth, checkTokenBlacklist, async (req, res) => {
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
router.put('/update-profile-picture', auth, checkTokenBlacklist, async (req, res) => {
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
router.put('/update-about-me', auth, checkTokenBlacklist, async (req, res) => {
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
router.put('/update-bird-call', auth, checkTokenBlacklist, async (req, res) => {
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
router.put('/update-my-birds', auth, checkTokenBlacklist, async (req, res) => {
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
router.put('/update-birds-i-watch', auth, checkTokenBlacklist, async (req, res) => {
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