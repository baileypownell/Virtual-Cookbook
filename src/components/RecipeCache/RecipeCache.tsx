
import { Snackbar } from '@material-ui/core'
import React, { useState } from 'react'
import { useMutation, useQuery } from 'react-query'
import { withRouter } from 'react-router-dom'
import BounceLoader from 'react-spinners/BounceLoader'
import { Dashboard, Recipe } from '..'
import { FullRecipe, RawRecipe } from '../../../server/recipe'
import { DefaultTile, NewFileInterface, RecipeInput, RecipeService, SortedRecipeInterface } from '../../services/recipe-services'
import { queryClient } from '../App/App'
export interface MealCategoriesType {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  side_dish: 'Side Dish',
  dessert: 'Dessert',
  drinks: 'Drinks',
  other: 'Other',
}

export interface AddRecipeMutationParam {
  recipeInput: RecipeInput,
  files: NewFileInterface[],
  defaultTile: DefaultTile | null
}

enum RecipeCategories {
  Other = 'Other',
  Lunch = 'Lunch',
  Dessert = 'Dessert',
  Breakfast = 'Breakfast',
  Drinks = 'Drinks',
  SideDish = 'Side Dish',
  Dinner = 'Dinner'
}

const determineRecipeCategory = (recipeCategory: string): string => {
  if (recipeCategory === RecipeCategories.Other) {
    return 'other'
  } else if (recipeCategory === RecipeCategories.Lunch) {
    return 'lunch'
  } else if (recipeCategory === RecipeCategories.Dessert) {
    return 'dessert'
  } else if (recipeCategory === RecipeCategories.Breakfast) {
    return 'breakfast'
  } else if (recipeCategory === RecipeCategories.Drinks) {
    return 'drinks'
  } else if (recipeCategory === RecipeCategories.SideDish) {
    return 'side_dish'
  } else if (recipeCategory === RecipeCategories.Dinner) {
    return 'dinner'
  }
}

function RecipeCache (props: any) {
  const { mutateAsync } = useMutation('recipes', async (recipeInput: AddRecipeMutationParam) => {
    try {
      const newRecipe: RawRecipe = await RecipeService.createRecipe(
        recipeInput.recipeInput, recipeInput.files, recipeInput.defaultTile
      )
      const recipe: FullRecipe = await RecipeService.getRecipe(newRecipe.recipe_uuid)
      return recipe
    } catch (err) {
      console.log(err)
    }
  }, {
    onSuccess: (newRecipe: FullRecipe) => {
      queryClient.setQueryData('recipes', (currentRecipes: SortedRecipeInterface) => {
        const recipeCategory: string = newRecipe.category || determineRecipeCategory(newRecipe.category)
        const updatedQueryState = {
          ...currentRecipes,
          [recipeCategory]: [...currentRecipes[recipeCategory], newRecipe].sort(RecipeService.sortByTitle)
        }
        return updatedQueryState
      })
    }
  })

  const { refetch, isLoading, error, data } = useQuery('recipes', async () => {
    try {
      const result: SortedRecipeInterface | {error: boolean, errorMessage: string} = await RecipeService.getRecipes()
      if (result.error) {
        return null
      } else {
        return result
      }
    } catch (error) {
      return error
    }
  }, {
    staleTime: Infinity
  })

  const fetchRecipes = async () => {
    const result = await refetch()
    return result.data
  }

  const [snackBarOpen, setSnackBarOpen] = useState(false)
  const [snackBarMessage, setSnackBarMessage] = useState('')
  const openSnackBar = (message: string) => {
    setSnackBarOpen(true)
    setSnackBarMessage(message)
  }

  const closeSnackBar = () => {
    setSnackBarMessage('')
    setSnackBarOpen(false)
  }

  if (isLoading) {
    return <div className="BounceLoader">
      <BounceLoader
        size={100}
        color={'#689943'}
      />
    </div>
  }

  const individualRecipe: boolean = !!props.match.params.id

  if (individualRecipe) {
    return (
      <>
        <Recipe
          openSnackBar={openSnackBar}
          addRecipeMutation={async (recipeInput: AddRecipeMutationParam) => await mutateAsync(recipeInput)}>
        </Recipe>
      </>
    )
  } else {
    return (
      <>
        <Dashboard
          recipes={data}
          fetchRecipes={() => fetchRecipes()}
          addRecipeMutation={async (recipeInput: AddRecipeMutationParam) => await mutateAsync(recipeInput)}>
        </Dashboard>
        <Snackbar
          open={snackBarOpen}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
          onClose={closeSnackBar}
          autoHideDuration={3000}
          message={snackBarMessage}
          key={'bottom' + 'center'}
        />
      </>
    )
  }
}

export default withRouter(RecipeCache)
