import React from 'react';
import M from 'materialize-css';
import './AddRecipe.scss';
const axios = require('axios');

class AddRecipe extends React.Component {

  state = {
    recipe_title: null,
    ingredients: null,
    directions: null,
    loading: null,
    category: this.props.category,
    recipeValid: false,
    modal: null
  }

  componentDidMount() {
    let modal = document.querySelectorAll('.modal');
    this.state.modal = M.Modal.init(modal, {
      opacity: 0.5
    });

    var select = document.querySelectorAll('select');
    M.FormSelect.init(select, {});
  }

  checkValidity = () => {
    const { directions, ingredients, recipe_title } = this.state;
    if (directions && ingredients && recipe_title) {
      this.setState({
        recipeValid: true
      })
    } else {
      this.setState({
        recipeValid: false
      })
    }
  }

  createRecipe = (e) => {
    e.preventDefault();
    this.setState({
      loading: true
    })
    axios.post(`/recipes`, {
      title: this.state.recipe_title,
      category: this.state.category,
      ingredients: this.state.ingredients,
      directions: this.state.directions,
    })
    .then(res => {
      if (res) {
        this.setState({
          loading: false
        });
        this.state.modal.forEach(m => m.close())
        this.props.updateDashboard();
        M.toast({html: 'Recipe added.'})
      }
    })
    .catch((err) => {
      console.log(err)
      this.setState({
        loading: false
      })
      M.toast({html: 'There was an error.'})
    })
  }

  updateInput = (e) => {
    this.setState({
      [e.target.id]: e.target.value
    }, () => this.checkValidity());
  }

  
  render() {
    const { id } = this.props;
    const options = [
      { value: 'breakfast', label: 'Breakfast' },
      { value: 'lunch', label: 'Lunch' },
      { value: 'dinner', label: 'Dinner' },
      { value: 'dessert', label: 'Dessert' },
      { value: 'side_dish', label: 'Side Dish' },
      { value: 'drinks', label: 'Drinks' },
      { value: 'other', label: 'Other' }
    ]

    return (
      <>
        <div
            data-target={`${this.state.category}_modal`}
            className="addRecipe z-depth-4 modal-trigger"
            id={id}
             >
            <i className="fas fa-plus-circle"></i>
        </div>

            <div id={`${this.state.category}_modal`} className="modal">
              
              <h1 className="Title">New Recipe</h1>
              <div className="recipe">
              <div>
                  <div className="input-field">
                      <textarea onChange={this.updateInput} id="recipe_title" value={this.state.recipe_title || ''} className="materialize-textarea"></textarea>
                      <label htmlFor="recipe_title">Title</label>
                  </div>
                  <div className="input-field">
                      <textarea onChange={this.updateInput} id="ingredients" value={this.state.ingredients || ''} className="materialize-textarea minHeight"></textarea>
                      <label htmlFor="ingredients">Ingredients</label>
                  </div>

                  <div className="input-field">
                    <textarea onChange={this.updateInput} id="directions" value={this.state.directions || ''} className="materialize-textarea minHeight"></textarea>
                    <label htmlFor="directions">Directions</label>
                  </div>
              
                  <div >
                    <h3>Category</h3>
                    <div className="select">
                      <select onChange={this.updateInput} id="category" value={this.state.category} >
                        {
                          options.map((val, index) => {
                            return <option key={index}>{val.label}</option>
                          })
                        }
                      </select>
                        
                    </div>
                </div>
                {/* <label>
                  <input type="checkbox" class="filled-in" />
                  <span>No baking required</span>
                </label> */}
                
              </div>
              <div className="modal-close-buttons">
                <button className="modal-close btn waves-effect waves-light grayBtn">Cancel</button>
                <button 
                  className={!this.state.recipeValid ? 'waves-effect waves-light btn disabled' : 'waves-effect waves-light btn enabled'}
                  disabled={!this.state.recipeValid} 
                  onClick={this.createRecipe}>Save
                 </button>
              </div>
              
            </div>
          </div> 
      </>
      
    )
  }
}

export default AddRecipe;
