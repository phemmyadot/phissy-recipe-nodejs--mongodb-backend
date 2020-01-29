const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const graphqlHTTP = require('express-graphql');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const User = require('./models/user');
const fileUpload = require('express-fileupload');

// const cors = require("cors");


const app = express();

const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '_' + file.originalname)
  }
});

app.use(fileUpload({
  useTempFiles: true
}));

cloudinary.config({
  cloud_name: 'codevillian',
  api_key: '478726612647927',
  api_secret: 'kEwzjOuPLWl1BEnHQa3Ew8LG4I4'
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/post-image', (req, res, next) => {
  console.log(req.files, req.body);
  const file = req.files.image;
  User.findOne({ email: req.body.email } || { displayName: req.body.displayName }).then(user => {
    if (user) {
      return;
    }
    if (!file) {
      return res.status(401).json({ message: 'No file provided!' });
    }
    cloudinary.uploader.upload(file.tempFilePath, function (error, result) {
      if (error) {
        return res.status(501).json({ message: 'Upload to Cloudinary failed!' });
      }
      return res.status(201).json({ message: 'File Uploaded to Cloudinary!', filePath: result.url });
    });
  })
});


app.use(auth);
// app.use(cors());

app.use(
  '/graphql',
  // cors(corsOptions),
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err) {
      if (!err.originalError) {
        return err;
      }
      console.log('error');
      const data = err.originalError.data;
      const message = err.message || 'An error occurred!';
      const code = err.originalError.code || 500;
      return {
        message: message,
        status: code,
        data: data
      }
    }
  })
);

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});
const uri =
  'mongodb+srv://codevillian:1qhhmfSUDW3ACwlM@cluster0-9jwcj.mongodb.net/phissy?retryWrites=true&w=majority';

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  autoIndex: false,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 500,
  poolSize: 10,
  bufferMaxEntries: 0
};
mongoose
  .connect(uri, options)
  .then(result => {
    console.log('connected to =>', uri);
    app.listen(8080);
  })
  .catch(err => console.log(err, 'error'));

