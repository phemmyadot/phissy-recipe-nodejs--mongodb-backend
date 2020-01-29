const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const recipeSchema = new Schema(
  {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    imageUrl: {
      type: String,
      required: true
    },
    imagePubicId: {
      type: String,
      required: true
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    likes: {
      type: Array,
      required: true
    },
    comments: {
      type: Array,
      required: true
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recipe', recipeSchema);
