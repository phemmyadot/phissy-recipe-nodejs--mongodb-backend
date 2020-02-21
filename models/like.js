const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const likeSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    recipeId: {
        type: String,
        required: true
    }
},
  { timestamps: true }
  );

  module.exports = mongoose.model('Like', likeSchema);