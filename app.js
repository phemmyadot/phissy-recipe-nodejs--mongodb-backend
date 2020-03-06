const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const graphqlHTTP = require('express-graphql');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const multer = require('multer');
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
  cloud_name: process.env.CLOUDINARY_NAME || 'codevillian',
  api_key: process.env.CLOUDINARY_API_KEY || '478726612647927',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'kEwzjOuPLWl1BEnHQa3Ew8LG4I4'
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

app.get('/post-image', (req, res, next) => {
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
      return res.status(201).json({ message: 'File Uploaded to Cloudinary!', filePath: result.url, publicId: result.public_id });
    });
  })
});

app.use('/confirm-account', (req, res, next) => {
  let decodedToken;
    try {
        decodedToken = jwt.verify(req.query.token, process.env.SECRET_KEY || 'adojuteleganbabafemisecretkey');
    } catch (err) {
        return next();
    }
    if (!decodedToken) {
        return next();
    }
    const userId = decodedToken.userId;
    User.update({_id: userId}, {
      emailConfirmation: true
    }, (err, affected, resp) => {
      return res.status(501).json({ message: 'Email confirmation failed!', status: false });
    })
    .then(resp => {
      return res.status(201).json({ message: 'Email Confirmed', status: true });
    })
    .then(resps => {
      return res.redirect('https://phissy-recipe-app.netlify.com/');
    });
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
const uri = process.env.MONGODB_CONNECT || 'mongodb+srv://codevillian:1qhhmfSUDW3ACwlM@cluster0-9jwcj.mongodb.net/phissy?retryWrites=true&w=majority';

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
    const server = app.listen(process.env.PORT || 8080);
    const io = require('./middleware/socket').init(server);
    io.on('connection', socket => {
      console.log('Client Connected');
    })
  })
  .catch(err => console.log(err, 'error'));

