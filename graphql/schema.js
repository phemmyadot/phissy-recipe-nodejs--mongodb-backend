const { buildSchema } = require("graphql");

module.exports = buildSchema(`
    type Recipe {
        _id: ID!
        title: String!
        description: String!
        imageUrl: String!
        creator: User!
        likes: [String]
        comments: [String]
        createdAt: String!
        updatedAt: String!
    }

    type User {
        _id: ID!
        firstName: String!
        lastName: String!
        displayName: String!
        email: String!
        password: String!
        imageUrl: String!
        recipes: [Recipe!]!
    }

    type AuthData {
        token: String!
        user: User!
    }

    type RecipeData {
        recipes: [Recipe!]!
        totalRecipes: Int!
    }

    input UserInputData {
        email: String!
        firstName: String!
        lastName: String!
        password: String!
        confirmPassword: String!
        displayName: String!
        imageUrl: String!
    }

    input RecipeInputData {
        title: String!
        description: String!
        imageUrl: String!
    }

    type RootQuery {
        login(email: String!, password: String!): AuthData!
        recipes(page: Int!): RecipeData!
        recipe(id: ID!): Recipe!
    }

    type RootMutation {
        createUser(userInput: UserInputData): User!
        createRecipe(recipeInput: RecipeInputData): Recipe!
        updateRecipe(id: ID!, recipeInput: RecipeInputData): Recipe!
        deleteRecipe(id: ID!): Boolean!
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }
`);
