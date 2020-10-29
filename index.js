const express = require('express');
const cors = require('cors');
const connectDB = require('./startup/db');
const app = express();
const users = require('./routes/users');
const blacklistedTokens = require('./routes/blacklistedTokens');
const auth = require('./routes/auth');
const bodyParser = require('body-parser');

connectDB();

app.use(bodyParser.urlencoded({
  limit: '5mb',
  parameterLimit: 100000,
  extended: false
}));
app.use(bodyParser.json({limit: '5mb'}));
app.use(express.json({limit: '5mb'}));
app.use(cors());
app.use('/api/users', users);
app.use('/api/blacklisted-tokens', blacklistedTokens);
app.use('/api/auth', auth);


const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server started on port: ${port}`);
});
