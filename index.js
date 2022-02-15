const express = require('express');
const app = express();
const PORT = 5000;


app.use('/', express.static('./src', { index: "index.html" }));

app.listen(
  PORT,
  () => console.log('Server running on port %d ...', PORT)
);
