const { Router } = require('express')
const client = require('../db')
const router = Router()
const authMiddleware = require('./authMiddleware.js')
const  { getPresignedUrls, getPresignedUrl, deleteAWSFiles } = require('./aws-s3')

const constructTags = (recipe) => {
  let tagArray = []
    if (recipe.no_bake) {
      tagArray.push("no_bake")
    }
    if (recipe.easy) {
      tagArray.push("easy")
    }
    if (recipe.healthy) {
      tagArray.push('healthy')
    }
    if (recipe.gluten_free) {
      tagArray.push('gluten_free')
    }
    if (recipe.dairy_free) {
      tagArray.push('dairy_free')
    }
    if (recipe.vegetarian) {
      tagArray.push('vegetarian')
    }
    if (recipe.vegan) {
      tagArray.push('vegan')
    }
    if (recipe.keto) {
      tagArray.push('keto')
    }
    if (recipe.sugar_free) {
      tagArray.push('sugar_free')
    }
    return tagArray
}

const formatRecipeResponse = (recipe) => {
  return {
    id: recipe.id, 
    title: recipe.title, 
    rawTitle: recipe.raw_title || recipe.title,
    category: recipe.category, 
    user_id: recipe.user_id, 
    ingredients: recipe.ingredients, 
    directions: recipe.directions, 
    tags: constructTags(recipe),
    defaultTileImageKey: recipe.default_tile_image_key,
    preSignedDefaultTileImageUrl: recipe.preSignedDefaultTileImageUrl
  }
}

router.use(authMiddleware)

router.get('/', authMiddleware, (request, response, next) => {
  let userId = request.userID
  client.query('SELECT * FROM recipes WHERE user_id=$1',
  [userId],
   (err, res) => {
    if (err) return next(err);
    let responseObject = {
      breakfast: [], 
      lunch: [],
      dinner: [], 
      dessert: [],
      other: [], 
      side_dish: [],
      drinks: []
    }
    if (res.rows.length) {
        let results = res.rows.map( recipe => {
          if (recipe.default_tile_image_key) {
            let preSignedDefaultTileImageUrl = getPresignedUrl(recipe.default_tile_image_key)
            return {
              ...recipe, 
              preSignedDefaultTileImageUrl: preSignedDefaultTileImageUrl,
            }
          } else {
            return recipe
          }
        })
        results.forEach((recipe) => {
          if (recipe.category === 'Dinner') {
            responseObject.dinner.push(formatRecipeResponse(recipe))
          } else if (recipe.category === 'Dessert') {
            responseObject.dessert.push(formatRecipeResponse(recipe))
          } else if (recipe.category === 'Drinks') {
            responseObject.drinks.push(formatRecipeResponse(recipe))
          } else if (recipe.category === 'Lunch') {
            responseObject.lunch.push(formatRecipeResponse(recipe))
          } else if (recipe.category === 'Breakfast') {
            responseObject.breakfast.push(formatRecipeResponse(recipe))
          } else if (recipe.category === 'Other') {
            responseObject.other.push(formatRecipeResponse(recipe))
          } else if (recipe.category === 'Side Dish') {
            responseObject.side_dish.push(formatRecipeResponse(recipe))
          }
        })
        response.json(responseObject)
    } else {
      return response.json(responseObject)
    } 
  })
})

router.post('/', (request, response, next) => {
  let userId = request.userID
  const { 
    title, 
    rawTitle,
    category, 
    ingredients, 
    directions, 
    isNoBake, 
    isEasy, 
    isHealthy, 
    isGlutenFree, 
    isDairyFree, 
    isSugarFree, 
    isVegetarian, 
    isVegan, 
    isKeto,
  } = request.body;
  if (
    !!rawTitle &&
    !!title && 
    !!category && 
    !!ingredients && 
    !!directions
   ) {
      client.query('INSERT INTO recipes(title, raw_title, category, user_id, ingredients, directions, no_bake, easy, healthy, gluten_free, dairy_free, sugar_free, vegetarian, vegan, keto) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING "id"',
        [title, rawTitle, category, userId, ingredients, directions, isNoBake, isEasy, isHealthy, isGlutenFree, isDairyFree, isSugarFree, isVegetarian, isVegan, isKeto],
        (err, res) => {
          if (err) return next(err)
          if (res.rowCount) {
            return response.status(200).json({ success: true, message: 'Recipe created.', recipeId: res.rows[0].id })
          } else {
            return response.status(500).json({ success: false, message: 'Could not create recipe.' })
          }
        })
    } else {
      return response.status(400).json({
        success: false, 
        message: 'Invalid request sent.'
      })
    }
})

router.put('/', (request, response, next) => {
  let userId = request.userID
  const { 
    recipeId, 
    title, 
    rawTitle, 
    ingredients,
    directions, 
    category, 
    isNoBake, 
    isEasy, 
    isHealthy, 
    isGlutenFree, 
    isDairyFree, 
    isSugarFree, 
    isVegetarian, 
    isVegan, 
    isKeto, 
    defaultTileImageKey
  } = request.body;
  client.query('UPDATE recipes SET title=$1, raw_title=$16, ingredients=$2, directions=$3, category=$4, no_bake=$5, easy=$6, healthy=$7, gluten_free=$8, dairy_free=$9, sugar_free=$10, vegetarian=$11, vegan=$12, keto=$13, default_tile_image_key=$17 WHERE id=$14 AND user_id=$15 RETURNING "id"',
  [title, ingredients, directions, category, isNoBake, isEasy, isHealthy, isGlutenFree, isDairyFree, isSugarFree, isVegetarian, isVegan, isKeto, recipeId, userId, rawTitle, defaultTileImageKey],
   (err, res) => {
    if (err) return next(err)
    if (res.rowCount) {
      return response.status(200).json({success: true, recipeId: res.rows[0].id})
    } else {
      return response.status(500).json({success: false, message: 'Could not update recipe.'})
    }
  });
})

const getImageAWSKeys = (recipeId) => {
  return new Promise((resolve, reject) => {
    client.query('SELECT key FROM files WHERE recipe_id=$1', 
    [recipeId], 
    (err, res) => {
      if (err) reject(err)
      let image_url_array = res.rows.reduce((arr, el) => {
        arr.push(el.key)
        return arr
      }, [])
      resolve(image_url_array)
    })
  })
}

router.get('/:recipeId', (request, response, next) => {
    const { recipeId } = request.params
    let userId = request.userID
    client.query('SELECT * FROM recipes WHERE user_id=$1 AND id=$2',
    [userId, recipeId],
     async(err, res) => {
      if (err) return next(err);
      let recipe = res.rows[0]
      if (recipe) {
        let recipe_response = {
          id: recipe.id, 
          title: recipe.title, 
          rawTitle: recipe.raw_title || recipe.title,
          category: recipe.category,  
          user_id: recipe.user_id, 
          ingredients: recipe.ingredients, 
          directions: recipe.directions, 
          tags: constructTags(recipe),
          defaultTileImageKey: recipe.default_tile_image_key
        }
        if (recipe.has_images) {
          let urls = await getImageAWSKeys(recipeId)
          if (urls) {
            recipe_response.image_uuids = urls
            recipe_response.preSignedUrls = getPresignedUrls(urls)
            response.status(200).json({ success: true, recipe: recipe_response })
          } 
        } else {
          response.status(200).json({ success: true, recipe: recipe_response })
        }        
      } else {
        response.status(500).json({ success: false, message: 'No recipe could be found.'})
      }
    })
  })

router.delete('/:recipeId', (request, response, next) => {
  let userId = request.userID
  const { recipeId } = request.params
  client.query('DELETE FROM recipes WHERE id=$1 AND user_id=$2 RETURNING has_images, id',
  [recipeId, userId],
      (err, res) => {
      if (err) return next(err);
      if (res) {
        let has_images = res.rows[0].has_images
        let recipe_id = res.rows[0].id
        if (has_images) {
          // delete images associated with the recipe from database
          client.query('DELETE FROM files WHERE recipe_id=$1 RETURNING key', 
          [recipe_id],
          async(error, res) => {
              if (error) return response.status(500).json({ success: false, message: `There was an error: ${error}`})
              // set recipe's "has_images" property to false if necessary
              if (res) {
                let awsKeys = res.rows.map(row => row.key) 
                // then delete from AWS S3
                let awsDeletions = await deleteAWSFiles(awsKeys)
                if (awsDeletions) {
                  return response.status(200).json({ success: true, message: 'Recipe deleted.' })
                }
              }  
          })
        } else {
          return response.status(200).json({ success: true, message: 'Recipe deleted.' })
        }
    }
  })
})

module.exports = router;