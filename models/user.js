const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    displayName: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    emailConfirmation: {
        type: Boolean,
        required: true
    },
    recipes: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Recipe'
        }
    ]
});

module.exports = mongoose.model('User', userSchema);