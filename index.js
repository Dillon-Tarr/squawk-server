const express = require('express');
const cors = require('cors');
const connectDB = require('./startup/db');
const app = express();
//const videos = require('./routes/file');

connectDB();

app.use(express.json());
app.use(cors());
//app.use('/api/videos', videos)

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server started on port: ${port}`);
});
