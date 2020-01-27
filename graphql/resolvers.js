const bcrypt = require('bcryptjs');

const validator = require('validator');

const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Recipe = require('../models/recipe');

module.exports = {
    createUser: async function ({ userInput }, req) {
        // const email = userInput.email
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
            imageUrl: userInput.imageUrl,
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
        await isAuth(req);
        await validateRecipeInput(recipeInput);
        const user = await User.findById(req.userId);
        await isValidUser(user);
        const recipe = new Recipe({
            title: recipeInput.title,
            description: recipeInput.description,
            category: recipeInput.category,
            imageUrl: recipeInput.imageUrl,
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
    recipes: async function ({ page }, req) {
        await isAuth(req);
        if (!page) {
            page = 1;
        }
        const perPage = 10;

        const totalRecipes = await Recipe.find().countDocuments();
        const recipes = await Recipe
            .find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .populate('creator');
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
        recipe.category = recipeInput.category;
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
        return true;
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
    if (validator.isEmpty(recipeInput.category)) {
        errors.push({ message: 'Category is not entered!' });
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