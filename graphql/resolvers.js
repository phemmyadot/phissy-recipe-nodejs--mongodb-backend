const bcrypt = require('bcryptjs');

const validator = require('validator');

const jwt = require('jsonwebtoken');

const cloudinary = require('cloudinary').v2;
const User = require('../models/user');
const Recipe = require('../models/recipe');
const Like = require('../models/like');


cloudinary.config({
    cloud_name: 'codevillian',
    api_key: '478726612647927',
    api_secret: 'kEwzjOuPLWl1BEnHQa3Ew8LG4I4'
});

module.exports = {
    createUser: async function ({ userInput }, req) {
        // const email = userInput.email
        let imageUrl;
        if (userInput.imageUrl.includes('http://')) {
            imageUrl = 'https://' + userInput.imageUrl.slice(7);
        } else if (userInput.imageUrl.includes('https://')) {
            imageUrl = userInput.imageUrl;
        }
        const errors = [];
        if (!validator.isEmail(userInput.email)) {
            errors.push({ message: 'E-mail is invalid!' });
        }
        if (
            validator.isEmpty(userInput.password) ||
            !validator.isLength(userInput.password, { min: 6 })
        ) {
            errors.push({ message: 'Password too short!' });
        }

        if (userInput.confirmPassword !== userInput.password) {
            errors.push.apply({ message: "Confirm password does not match!" })
        }
        if (validator.isEmpty(userInput.firstName)) {
            errors.push.apply({ message: "First name cannot be empty!" })
        }
        if (validator.isEmpty(userInput.lastName)) {
            errors.push.apply({ message: "Last name cannot be empty!" })
        }
        if (validator.isEmpty(userInput.displayName)) {
            errors.push.apply({ message: "User name cannot be empty!" })
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input!');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const existingUser = await User.findOne({ email: userInput.email } || { displayName: userInput.displayName });
        if (existingUser) {
            const error = new Error('User already exists!');
            throw error;
        }
        const hashedPw = await bcrypt.hash(userInput.password, 12);
        const user = new User({
            email: userInput.email,
            displayName: userInput.displayName,
            firstName: userInput.firstName,
            lastName: userInput.lastName,
            password: hashedPw,
            role: "tester",
            imageUrl: imageUrl,
        });
        const createdUser = await user.save();
        return { ...createdUser._doc, _id: createdUser._id.toString() };
    },
    login: async function ({ email, password }) {
        const errors = [];
        if (!validator.isEmail(email)) {
            errors.push({ message: 'E-mail is invalid!' });
        }
        if (
            validator.isEmpty(password) ||
            !validator.isLength(password, { min: 6 })
        ) {
            errors.push({ message: 'Password too short!' });
        }
        const user = await User.findOne({ email: email } || { displayName: email });
        await isValidUser(user);
        let isEqual;
        await bcrypt.compare(password, user.password).then(valid => {
            isEqual = valid;
        });
        if (!isEqual) {
            const error = new Error('Password is incorrect.');
            error.code = 401;
            throw error;
        }
        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email,
            },
            'adojuteleganbabafemisecretkey',
            { expiresIn: '1h' }
        );
        return { token: token, user: user };
    },
    createRecipe: async function ({ recipeInput }, req) {
        let imageUrl;
        if (recipeInput.imageUrl.includes('http://')) {
            imageUrl = 'https://' + recipeInput.imageUrl.slice(7);
        } else if (recipeInput.imageUrl.includes('https://')) {
            imageUrl = recipeInput.imageUrl;
        }

        await isAuth(req);
        await validateRecipeInput(recipeInput);
        const user = await User.findById(req.userId);
        await isValidUser(user);
        const recipe = new Recipe({
            title: recipeInput.title,
            description: recipeInput.description,
            imageUrl: imageUrl,
            imagePubicId: recipeInput.imagePubicId,
            creator: user
        });

        const createdRecipe = await recipe.save();
        user.recipes.push(createdRecipe);
        await user.save();
        return {
            ...createdRecipe._doc,
            _id: createdRecipe._id.toString(),
            createdAt: createdRecipe.createdAt.toString(),
            updatedAt: createdRecipe.updatedAt.toString()
        }
    },
    recipes: async function ({ page, perPage }, req) {
        await isAuth(req);
        if (!page) {
            page = 1;
        }
        if (!perPage) {
            perPage = 5;
        }

        const totalRecipes = await Recipe.find().countDocuments();
        const recipes = await Recipe
            .find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .populate('creator')
            .populate('likes');
        return {
            recipes: recipes.map(recipe => {
                return {
                    ...recipe._doc,
                    _id: recipe._id.toString(),
                    createdAt: recipe.createdAt.toISOString(),
                    updatedAt: recipe.updatedAt.toISOString()
                };
            }),
            totalRecipes: totalRecipes
        };
    },
    recipe: async function ({ id }, req) {
        await isAuth(req);
        const recipe = await Recipe.findById(id).populate('creator');
        await isFound(recipe);
        return {
            ...recipe._doc,
            _id: recipe._id.toString(),
            createdAt: recipe.createdAt.toISOString(),
            updatedAt: recipe.updatedAt.toISOString()
        }
    },
    updateRecipe: async function ({ id, recipeInput }, req) {
        await isAuth(req);

        await validateRecipeInput(recipeInput);
        const recipe = await Recipe.findById(id).populate('creator');
        await isFound(recipe);
        await isCreator(req, recipe);
        recipe.title = recipeInput.title;
        recipe.description = recipeInput.description;
        recipe.imagePubicId = recipeInput.imagePubicId;
        if (recipe.imageUrl !== 'undefined') {
            recipe.imageUrl = recipeInput.imageUrl;
        }
        const updatedRecipe = await recipe.save();
        return {
            ...updatedRecipe._doc,
            _id: updatedRecipe._id.toString(),
            createdAt: recipe.createdAt.toISOString(),
            updatedAt: recipe.updatedAt.toISOString()
        }
    },
    deleteRecipe: async function ({ id }, req) {
        await isAuth(req);
        const recipe = await Recipe.findById(id);
        await isFound(recipe);
        await isCreator(req, recipe);
        await Recipe.findByIdAndRemove(id);
        const user = await User.findById(req.userId);
        user.recipes.pull(id);
        await user.save();
        await cloudinary.uploader.destroy(recipe.imagePubicId, function (result) { console.log(result) });
        return true;
    },
    likeRecipe: async function ({recipeId, userId}, req) {
        await isAuth(req);
        const recipe = await Recipe.findById(recipeId).populate('likes');
        const existingLike = await Like.findOne({userId: userId, recipeId: recipeId});
        if (existingLike) {
            await Like.findByIdAndRemove(existingLike._id.toString());
            recipe.likes.pull(existingLike._id);
            await recipe.save();
            return {
                ...existingLike._doc,
                _id: existingLike._id.toString(),
                isLike: false
            }
        }

        await isFound(recipe);
        const like = new Like({
            userId: userId,
            recipeId: recipeId
        });
        const liked = await like.save();
        recipe.likes.push(liked._id);
        await recipe.save();
        return {
            ...liked._doc,
            _id: liked._id.toString(),
            isLike: true
        }
    }

};


function isAuth(req) {
    if (!req.isAuth) {
        const error = new Error('Not authenticated!');
        error.code = 401;
        throw error;
    }
}

function isCreator(req, recipe) {
    if (recipe.creator._id.toString() !== req.userId.toString()) {
        const error = new Error('Not authorized!');
        error.code = 403;
        throw error;
    }
}

function isFound(recipe) {
    if (!recipe) {
        const error = new Error('No recipe found!');
        error.code = 404;
        throw error;
    }
}

function validateRecipeInput(recipeInput) {
    const errors = [];
    if (validator.isEmpty(recipeInput.title)) {
        errors.push({ message: 'Title is not entered!' });
    }
    if (validator.isEmpty(recipeInput.description)) {
        errors.push({ message: 'Description is not entered!' });
    }
    if (validator.isEmpty(recipeInput.imageUrl)) {
        errors.push({ message: 'ImageUrl is not entered!' });
    }
    if (errors.length > 0) {
        const error = new Error('Invalid Input.');
        error.data = errors;
        error.code = 422;
        throw error;
    }
}

function isValidUser(user) {
    if (!user) {
        const error = new Error('User does not exist!');
        error.code = 401;
        throw error;
    }
}
