import axios from 'axios'
import { UploadedFileResult } from '../models/images'
import tag from '../models/tags'
import { RawRecipe, FullRecipe } from '../../server/recipe'
import { TileImageSetResponse } from '../../server/file-upload'

export interface BaseStringAccessibleObjectBoolean {
  [key: string]: boolean;
}

export interface BaseStringAccessibleObjectString {
  [key: string]: string;
}

export interface BaseStringAccessibleObjectRecipeInterface {
  [key: string]: FullRecipe[];
}

export interface SortedRecipeInterface
  extends BaseStringAccessibleObjectRecipeInterface {
  breakfast: FullRecipe[]
  dessert: FullRecipe[]
  dinner: FullRecipe[]
  drinks: FullRecipe[]
  lunch: FullRecipe[]
  other: FullRecipe[]
  side_dish: FullRecipe[]
}

export interface RecipeInput {
  title: string;
  rawTitle: string;
  category: string;
  ingredients: string;
  directions: string;
  isNoBake: boolean;
  isEasy: boolean;
  isHealthy: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  isSugarFree: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isKeto: boolean;
}

export interface NewFileInterface {
  file: {
    lastModified: Date; // unix
    lastModifiedDate: Date;
    name: string;
    size: number;
    type: string;
    webkitRelativePath: string;
  };
  id: string;
}

export interface DefaultTile {
  newFile: boolean;
  fileName: string;
}

export interface RecipeInterface {
  id: string;
  title: string;
  rawTitle: string;
  category: string;
  user_id: number;
  ingredients: string;
  directions: string;
  tags: tag[];
  defaultTileImageKey: string;
  preSignedUrls: string[];
}

export interface UpdateRecipeInput {
  title: string;
  rawTitle: string;
  ingredients: string;
  directions: string;
  recipeId: string;
  category: string;
  isNoBake: boolean;
  isEasy: boolean;
  isHealthy: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  isSugarFree: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isKeto: boolean;
}

export interface DefaultTileExisting {
  key: string;
}

// TO-DO: give this meaning
export interface ExistingFile {}

export const RecipeService = {
  sortByTitle (
    a: RecipeInput | FullRecipe,
    b: RecipeInput | FullRecipe
  ) {
    return a.rawTitle.localeCompare(b.rawTitle)
  },

  getRecipes: async (): Promise<SortedRecipeInterface> => {
    try {
      const recipes = await axios.get('/recipe')
      for (const category in recipes.data) {
        const sortedCategory = recipes.data[category].sort(
          RecipeService.sortByTitle
        )
        recipes.data[category] = sortedCategory
      }
      return recipes.data
    } catch (error) {
      console.log(error)
      return error
    }
  },

  getRecipe: async (recipeId: string): Promise<FullRecipe> => {
    const recipeResponse = await axios.get(`/recipe/${recipeId}`)
    return recipeResponse.data
  },

  deleteRecipe: async (recipeId: string): Promise<{recipeDeleted: boolean}> => {
    return await axios.delete(`/recipe/${recipeId}`)
  },

  createRecipe: (
    recipeInput: RecipeInput,
    files: NewFileInterface[],
    defaultTile: DefaultTile | null
  ): Promise<RawRecipe> => {
    return axios.post('/recipe', recipeInput)
      .then(recipeCreated => {
        if (files?.length) {
          return RecipeService.uploadFiles(recipeCreated.data.recipe_uuid, files)
            .then((uploadedImageKeys) => {
              const defaultTileImage = uploadedImageKeys.find(
                (obj) => obj.fileName === defaultTile?.fileName
              )

              if (defaultTileImage) {
                return RecipeService.handleDefaultTileImage(
                  recipeCreated.data.recipe_uuid,
                  defaultTileImage.awsKey
                )
                  .then(() => recipeCreated.data)
              } else {
                return recipeCreated.data
              }
            })
        }

        return recipeCreated.data
      })
      .catch(e => { return e })
  },

  handleDefaultTileImage: (recipeId: string, awsKey: string) => {
    return RecipeService.setTileImage(recipeId, awsKey)
  },

  uploadFiles: async (
    recipeId: string,
    files: NewFileInterface[]
  ): Promise<UploadedFileResult[]> => {
    return await Promise.all(
      files.map(async (file: NewFileInterface) => {
        const formData = new FormData()
        formData.append('image', file.file as any)

        const upload = await axios.post(`/file-upload/${recipeId}`, formData, {
          headers: {
            'content-type': 'multipart/form-data'
          }
        })
        return {
          awsKey: upload.data.key,
          fileName: file.file.name
        }
      })
    )
  },

  updateRecipe: (
    recipeInput: UpdateRecipeInput,
    files: NewFileInterface[],
    defaultTile: DefaultTile | string | null, // string if existing image on recipe, not new one
    filesToDeleteKeys: string[],
    recipeId: string,
    recipe: RecipeInterface
  ): Promise<RawRecipe> => {
    return axios.put('/recipe', recipeInput)
      .then(res => {
        const recipeUpdated: RawRecipe = res.data
        const uploads: NewFileInterface[] = files
        const uploading = !!uploads.length
        const deleting = !!filesToDeleteKeys?.length

        // bug: uploading and deleting OR just uploading AND setting default image to a PREEXISTING image
        if (uploading && deleting) {
          return RecipeService.uploadFiles(recipeId, uploads)
            .then(uploadedImageKeys => {
              return RecipeService.deleteFiles(filesToDeleteKeys)
                .then(() => {
                  if (defaultTile) {
                    let awsKey: string
                    if (uploadedImageKeys.find(obj => obj.fileName === (defaultTile as DefaultTile).fileName)) {
                      awsKey = uploadedImageKeys.find(obj => obj.fileName === (defaultTile as DefaultTile).fileName).awsKey
                    } else {
                      awsKey = defaultTile as string
                    }
                    return RecipeService.setTileImage(recipeUpdated.recipe_uuid, awsKey).then(() => recipeUpdated)
                  } else if (recipe.defaultTileImageKey) {
                    return RecipeService.removeTileImage(recipeId).then(() => recipeUpdated)
                  } else {
                    return recipeUpdated
                  }
                })
                .catch(e => e)
            })
        } else if (uploading) {
          return RecipeService.uploadFiles(recipeId, uploads)
            .then(uploadedImageKeys => {
              if (defaultTile) {
                let awsKey: string
                if (uploadedImageKeys.find(obj => obj.fileName === (defaultTile as DefaultTile).fileName)) {
                  awsKey = uploadedImageKeys.find(obj => obj.fileName === (defaultTile as DefaultTile).fileName).awsKey
                } else {
                  awsKey = defaultTile as string
                }
                return RecipeService.setTileImage(recipeUpdated.recipe_uuid, awsKey).then(() => recipeUpdated)
              } else if (recipe.defaultTileImageKey) {
                return RecipeService.removeTileImage(recipeId).then(() => recipeUpdated)
              } else {
                return recipeUpdated
              }
            })
            .catch(e => e)
        } else if (deleting) {
          return RecipeService.deleteFiles(filesToDeleteKeys)
            .then(() => {
              if (defaultTile) {
                return RecipeService.setTileImage(recipeId, defaultTile)
                  .then(() => recipeUpdated)
              } else if (recipe.defaultTileImageKey) {
                return RecipeService.removeTileImage(recipeId)
                  .then(() => recipeUpdated)
              } else {
                return recipeUpdated
              }
            })
        } else {
          if (defaultTile) {
            return RecipeService.setTileImage(recipeId, defaultTile)
              .then(() => recipeUpdated)
              .catch(e => e)
          } else if (recipe.defaultTileImageKey) {
            return RecipeService.removeTileImage(recipeId)
              .then(() => recipeUpdated)
              .catch(e => e)
          } else {
            return recipeUpdated
          }
        }
      })
      .catch(e => e)
  },

  deleteFiles: async (filesToDeleteKeys: string[]) => {
    return await Promise.all(
      filesToDeleteKeys.map(async (url) => {
        const key = url.split('amazonaws.com/')[1].split('?')[0]
        return await axios.delete(`/file-upload/${key}`)
      })
    )
  },

  removeTileImage: async (recipeId: string): Promise<TileImageSetResponse> => {
    return axios.delete(`file-upload/tile-image/${recipeId}`)
  },

  setTileImage: async (recipeId: string, awsKey: string): Promise<TileImageSetResponse> => {
    return axios.post(`/file-upload/tile-image/${awsKey}/${recipeId}`)
  }
}
