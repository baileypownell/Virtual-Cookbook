import axios from 'axios'
import { UploadedFileResult } from '../models/images'
import tag from '../models/tags'
import { async } from 'rxjs'
import { DashboardReadyRecipe } from '../components/RecipeCache/RecipeCache'

export interface BaseStringAccessibleObjectBoolean {
    [key: string]: boolean
}

export interface BaseStringAccessibleObjectString {
    [key: string]: string
}

export interface BaseStringAccessibleObjectRecipeInterface {
    [key: string]: RecipeInterface[]
}

export interface RecipeInterface {
  title: string
  raw_title: string
  category: string
  user_uuid: string
  ingredients: string
  directions: string
  no_bake: boolean
  easy: boolean 
  healthy: boolean 
  gluten_free: boolean
  dairy_free: boolean
  sugar_free: boolean
  vegetarian: boolean
  vegan: boolean
  keto: boolean
}

export interface SortedRecipeInterface extends BaseStringAccessibleObjectRecipeInterface {
    breakfast: RecipeInterface[]
    dessert: RecipeInterface[]
    dinner: RecipeInterface[]
    drinks:RecipeInterface[]
    lunch: RecipeInterface[]
    other: RecipeInterface[]
    side_dish: RecipeInterface[]
}


export interface RecipeInput {
    title: string, 
    rawTitle: string, 
    category: string, 
    ingredients: string, 
    directions: string, 
    isNoBake: boolean, 
    isEasy: boolean, 
    isHealthy: boolean, 
    isGlutenFree: boolean, 
    isDairyFree: boolean, 
    isSugarFree: boolean, 
    isVegetarian: boolean, 
    isVegan: boolean, 
    isKeto: boolean
}

export interface NewFileInterface {
    file: {
        lastModified: Date // unix
        lastModifiedDate: Date
        name: string
        size: number
        type: string
        webkitRelativePath: string
    },
    id: string
}

export interface DefaultTile {
    newFile: boolean 
    fileName: string
}

export interface RecipeInterface {
    id: string
    title: string
    rawTitle: string
    category: string
    user_id: number
    ingredients: string
    directions: string
    tags: tag[]
    defaultTileImageKey: string
    preSignedUrls: string[]
}

export interface UpdateRecipeInput {
    title: string
    rawTitle: string
    ingredients: string
    directions: string
    recipeId: string
    category: string
    isNoBake: boolean
    isEasy: boolean
    isHealthy: boolean
    isGlutenFree: boolean 
    isDairyFree: boolean
    isSugarFree: boolean
    isVegetarian: boolean 
    isVegan: boolean
    isKeto: boolean
}

export interface DefaultTileExisting {
    key: string
}

// TO-DO: give this meaning
export interface ExistingFile {

}

export const RecipeService = {

    sortByTitle(a: RecipeInterface | RecipeInput | DashboardReadyRecipe, b: RecipeInterface | RecipeInput | DashboardReadyRecipe) {
      return a.rawTitle.localeCompare(b.rawTitle)
    },

    getRecipes: async(): Promise<SortedRecipeInterface> => {
      try {
        let recipes = await axios.get(`/recipe`)
        for (const category in recipes.data) {
            let sortedCategory = recipes.data[category].sort(RecipeService.sortByTitle)
            recipes.data[category] = sortedCategory
          }
        return recipes.data
      } catch(error) {
        console.log(error)
        return error
      }
    },

    getRecipe: async(recipeId: string): Promise<RecipeInterface> => {
      let recipeResponse = await axios.get(`/recipe/${recipeId}`)
      return recipeResponse.data.recipe
    },

    deleteRecipe: async(recipeId: string): Promise<any> => {
      return await axios.delete(`/recipe/${recipeId}`)
    },

    createRecipe: (recipeInput: RecipeInput, files: NewFileInterface[], defaultTile: DefaultTile | null) => {
      return new Promise(async(resolve, reject) => {
        let recipeCreated = await axios.post('/recipe', recipeInput)
        if (files?.length) {
          try {
            // we must get the AWS KEY from this call
            let uploadedImageKeys = await RecipeService.uploadFiles(recipeCreated.data.recipe.recipe_uuid, files)
            let defaultTileImage = uploadedImageKeys.find(obj => obj.fileName === defaultTile?.fileName)
            if (defaultTileImage) {
              await RecipeService.handleDefaultTileImage(recipeCreated.data.recipe.recipe_uuid, defaultTileImage.awsKey)
            }
            resolve({recipeAdded: true, recipe: recipeCreated.data.recipe})
          } catch (error) {
            console.log(error)
            reject({err: true, error})
          }
        } else {
          resolve({recipeAdded: true, recipe: recipeCreated.data.recipe})
        }
      })
    },
    handleDefaultTileImage: (recipeId: number, awsKey: string) => {
        return new Promise(async(resolve, reject) => {
            try {
                let defaultTile = await RecipeService.setTileImage(recipeId, awsKey)
                resolve(defaultTile)
            } catch(e) {
                reject(e)
            }
        })
    }, 

    uploadFiles: async(recipeId: number, files: NewFileInterface[]): Promise<UploadedFileResult[]> => {
      return await Promise.all(files.map( async (file: NewFileInterface) => {
        let formData = new FormData() 
        formData.append('image', file.file as any)
    
        let upload = await axios.post(
            `/file-upload/${recipeId}`, 
            formData,
            {
                headers: {
                    'content-type': 'multipart/form-data'
                }
            }
        )
        return { 
            awsKey: upload.data.key, 
            fileName: file.file.name 
        }
      }))
    },

    updateRecipe: (
        recipeInput: UpdateRecipeInput, 
        files: NewFileInterface[], 
        defaultTile: DefaultTile | DefaultTileExisting | null,
        filesToDeleteKeys: string[],
        recipeId: number,
        recipe: RecipeInterface
        ) => {
          return new Promise(async(resolve, reject) => {
              let recipeUpdated = await axios.put(`/recipe`, recipeInput)
              let uploads: NewFileInterface[] = files
              let uploading: boolean = !!uploads.length 
              let deleting: boolean = !!filesToDeleteKeys?.length
              let uploadedImageKeys: UploadedFileResult[]
              if (uploading && deleting) {
                  uploadedImageKeys = await RecipeService.uploadFiles(recipeId, uploads)
                  await RecipeService.handleDefaultTileImageNew(recipeUpdated.data.recipeId, uploadedImageKeys, defaultTile, recipe.defaultTileImageKey)
                  await RecipeService.deleteFiles(filesToDeleteKeys)
                  resolve({ recipeUpdate: true })
              } else if (uploading) { 
                  uploadedImageKeys = await RecipeService.uploadFiles(recipeId, uploads)
                  await RecipeService.handleDefaultTileImageNew(recipeUpdated.data.recipeId, uploadedImageKeys, defaultTile, recipe.defaultTileImageKey)
                  resolve({ recipeUpdate: true })
              } else if (deleting) {
                  await RecipeService.deleteFiles(filesToDeleteKeys)
                  await RecipeService.handleDefaultTileImageExisting(recipeUpdated.data.recipeId, defaultTile, recipe.defaultTileImageKey)
                  resolve({ recipeUpdate: true })
              } else {        
                  await RecipeService.handleDefaultTileImageExisting(recipeUpdated.data.recipeId, defaultTile, recipe.defaultTileImageKey)
                  resolve({ recipeUpdate: true })
              }
          })        
    },

    handleDefaultTileImageNew: (
        recipeId: number, 
        uploadedImageKeys: {awsKey: string, fileName: string}[],
        defaultTileImage: DefaultTileExisting | null | DefaultTile,
        defaultTileImageKey: string | null 
    ) => {
        return new Promise(async(resolve, reject) => {
          if (defaultTileImageKey || defaultTileImage) {
            let isNewDefaultTile = (typeof defaultTileImage === 'string' && defaultTileImage !== defaultTileImageKey) || typeof defaultTileImage !== 'string'
            if (isNewDefaultTile) {
                let uploadThatIsDefault: UploadedFileResult | undefined = uploadedImageKeys.find(obj => obj.fileName === (defaultTileImage as DefaultTile).fileName)
                if (uploadThatIsDefault) {
                  try {
                    let defaultTile = await RecipeService.setTileImage(recipeId, uploadThatIsDefault.awsKey)
                    resolve(defaultTile)
                  } catch(err) {
                    reject(err)
                  }
                }
            } else {
              resolve()
            }
          } else {
            // removing default tile image if recipe previously had a default image 
            if (!defaultTileImageKey && defaultTileImageKey) {
              await RecipeService.removeTileImage(recipeId)
              resolve()
            } else {
              resolve()
            }
          }
        })
      },



    deleteFiles: async(filesToDeleteKeys: string[]) => {
        return await Promise.all(filesToDeleteKeys.map( async url => {
            let key = url.split('amazonaws.com/')[1].split('?')[0]
            return await axios.delete(`/file-upload/${key}`)
        })
        )
    },

    removeTileImage: async(recipeId: number) => {
        try {
          return await axios.delete(`file-upload/tile-image/${recipeId}`)
        } catch(err) {
          console.log(err)
          return err
        }
      },

      setTileImage: async(recipeId: number, awsKey: string) => {
        try {
          return await axios.post(`/file-upload/tile-image/${awsKey}/${recipeId}`)
        } catch(err) {
          console.log(err)
          return err
        }
      },

      handleDefaultTileImageExisting: (recipeId: number, defaultTileImageKey: any, recipeDefaultTileImageKey: string) => {
        return new Promise(async(resolve, reject) => {
          if (defaultTileImageKey) {
            try {
              let defaultTile = await RecipeService.setTileImage(recipeId, defaultTileImageKey)
              resolve(defaultTile)
            } catch(err) {
              reject(err)
            }
          } else {
            if (!defaultTileImageKey && recipeDefaultTileImageKey) {
              await RecipeService.removeTileImage(recipeId)
              resolve()
            } else {
              resolve()
            }
          }
        })
      },

}

