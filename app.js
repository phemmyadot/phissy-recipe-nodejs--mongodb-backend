const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const graphqlHTTP = require('express-graphql');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');

// const cors = require("cors");


const app = express();

app.use(bodyParser.json());

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
var corsOptions = {
  origin: 'http://localhost:8100',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

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

