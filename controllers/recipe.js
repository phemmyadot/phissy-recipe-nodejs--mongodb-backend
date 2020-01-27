const { validationResult } = require('express-validator');

const fs = require('fs');

const path = require('path');

const User = require('../models/user');

const Recipe = require('../models/recipe');

exports.fetchAllRecipes = (req, res, next) => {
  const currentPage = +req.query.currentPage || 1;
  const pageSize = +req.query.pageSize || 5;
  console.log(currentPage, pageSize);
  let totalRecipes;
  Recipe.find().countDocuments()
    .then(count => {
      totalRecipes = count;
      return Recipe.find()
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize);
    })
    .then(recipes => {
      res
        .status(200)
        .json({ message: 'Fetch Successful!', recipes: recipes, totalRecipes: totalRecipes });
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });

};

exports.fetchRecipeById = (req, res, next) => {
  const recipeId = req.params.recipeId;
  Recipe.findById(recipeId)
    .then(recipe => {
      if (!recipe) {
        const error = new Error('Could not find recipe!');
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({ message: 'Fetch Successful!', recipe: recipe });
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.createRecipe = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  // if (!req.file) {
  //   const error = new Error('No image picked!');
  //   error.statusCode = 422;
  //   throw error;
  // }
  const title = req.body.title;
  const description = req.body.description;
  // const imageUrl = req.file.path;
  const imageUrl = req.body.imageUrl;
  let creator;
  const recipe = new Recipe({
    title: title,
    description: description,
    imageUrl: imageUrl,
    creator: req.userId
  });
  recipe
    .save()
    .then(result => {
      return User.findById(req.userId);
    })
    .then(user => {
      creator = user;
      user.recipes.push(recipe);
      return user.save();
    })
    .then(result => {
      res.status(201).json({
        message: 'Recipe Created Successfully!',
        recipe: recipe,
        creator: { _id: creator._id, email: creator.email }
      });
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.updateRecipe = (req, res, next) => {
  const recipeId = req.params.recipeId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  const title = req.body.title;
  const description = req.body.description;
  let imageUrl = req.body.imageUrl;
  // if (req.file) {
  // const imageUrl = req.file.path;
  // }
  // if (!imageUrl) {
  //   const error = new Error('No image picked!');
  //   error.statusCode = 422;
  //   throw error;
  // }
  const creator = req.body.creator;

  Recipe.findById(recipeId)
    .then(recipe => {
      if (!recipe) {
        const error = new Error('Could not find recipe!');
        error.statusCode = 404;
        throw error;
      }
      if (recipe.creator.toString() !== req.userId) {
        const error = new Error('Not authorized!');
        error.statusCode = 403;
        throw error;
      }
      // if (imageUrl !== recipe.imageUrl) {
      //   clearImage(recipe.imageUrl);
      // }
      recipe.title = title;
      recipe.description = description;
      recipe.imageUrl = imageUrl;
      recipe.creator = creator;
      return recipe.save();
    })
    .then(result => {
      res.status(200).json({ message: 'Recipe updated!', recipe: recipe });
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.removeRecipe = (req, res, next) => {
  const recipeId = req.params.recipeId;
  Recipe.findById(recipeId)
    .then(recipe => {
      //Check Logged In User
      if (!recipe) {
        const error = new Error('Could not find recipe!');
        error.statusCode = 404;
        throw error;
      }
      if (recipe.creator.toString() !== req.userId) {
        const error = new Error('Not authorized!');
        error.statusCode = 403;
        throw error;
      }
      //   clearImage(recipe.imageUrl);
      return Recipe.findByIdAndRemove(recipeId);
    })
    .then(result => {
      return User.findById(req.userId);
    })
    .then(user => {
      user.recipes.pull(recipeId);
      return user.save();
    })
    .then(result => {
      res.status(200).json({ message: 'Recipe deleted!' })
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
}



// const clearImage = filePath => {
//   filePath = path.join(__dirname, '..', filePath);
//   fs.unlink(filePath, err => console.log(err));
// }
