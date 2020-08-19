import React from 'react';
import { connect } from 'react-redux';
import * as actions from '../../store/actionCreators';
import { withRouter } from "react-router-dom";
import axios from 'axios';
import M from 'materialize-css';
import './Settings.scss';


class Settings extends React.Component {

  state = {
    password: '',
    firstName: '',
    firstNameReceived: '',
    lastName: '',
    lastNameReceived: '',
    new_email: ''
  }

  logout = () => {
    axios.get('/logout')
    .then((res) => {
      console.log(res);
      this.props.logout();
      this.props.history.push('/home');
    })
    .catch((err) => {
      console.log(err)
    })
  }

  resetPassword = () => {
    axios.post(`/sendResetEmail`, {
      email: this.state.email
    })
    .then(res => {
      if (res.data.success === false) {
        M.toast({html: 'There was an error.'})
      } else {
        M.toast({html: 'Check your email for a link to reset your password.'})
      }
    })
    .catch(err => {
      M.toast({html: 'Whoops! Password could not be reset.'})
    })
  }

  componentDidMount() {
    let faded = document.querySelectorAll('.fade');
    let Appear = () => {
      for (let i = 0; i <faded.length; i++) {
      faded[i].classList.add('fade-in');
      }
    }
    setTimeout(Appear, 500);

    document.addEventListener('DOMContentLoaded', function() {
      var elems = document.querySelectorAll('.collapsible');
      var instances = M.Collapsible.init(elems, {});
    });
    this.updateView()
}

  updateInput = (e) => {
    this.setState({
      [e.target.id]: e.target.value
    })
  }

  updateProfile = (e) => {
      const { firstName, lastName } = this.state;
      const { id } = this.props;
      e.preventDefault();
      let payload = {
          first_name: firstName,
          last_name: lastName,
          id: id
      }
      axios.put(`/users`, payload)
      .then((res) => {
        M.toast({html: 'Profile updated successfully.'})
        this.updateView()
      })
      .catch(err => {console.log(err)})
  }

updateEmail = (e) => {
  e.preventDefault();
  axios.put(`/users`, {
    new_email: this.state.new_email,
    password: this.state.password,
    id: this.props.id
  })
  .then(res => {
    if (res.data.success === false) {
      M.toast({html: 'Whoops, email could not be updated.'})
    } else if (res.data.success === true) {
      M.toast({html: 'Email updated successfully.'})
      this.updateView()
    }
  })
  .catch(err => {
    console.log(err);
    M.toast({html: 'There was an error.'})
  })
}

  deleteAccount = (e) => {
    e.preventDefault();
    // first validate that their email is correct...
    axios.post(`/signin`, {
      password: this.state.password,
      email: this.state.email
    })
    .then(res => {
      if (res.data.success === false) {
        M.toast({html: 'The password you entered is incorrect.'})
      } else {
        axios.delete(`/users/${this.props.id}`)
        .then((res) => {
          axios.delete(`/recipes/all/${this.props.id}`)
          .then(res => {
            M.toast({html: 'Account deleted.'})
            // update redux
            this.props.logout();
            this.props.history.push('/home');
          })
        })
        .catch(err => console.log(err))
      }
    })
    .catch((err) => {
      console.log(err)
      M.toast({html: 'There was an error.'})
    })
  }

  updatePassword = (e) => {
    e.preventDefault();
    axios.post('/sendResetEmail', {
      email: this.state.email
    })
    .then(() => {
      M.toast({html: 'Password email sent.'})
    })
    .catch((err) => {
      console.log(err)
      M.toast({html: 'There was an error.'})
    })
  }

  updateView() {
    axios.get(`/users/${this.props.email}`)
    .then((res) => {
      let user = res.data.rows[0]
      console.log(res)
      this.setState({
        firstName: user.first_name, 
        firstNameReceived: user.first_name, 
        lastName: user.last_name,
        lastNameReceived: user.last_name,
        email: user.email
      })
      M.updateTextFields()
    })
    .catch((err) => console.log(err))
    
  }

  render() {
    return (
      <>
        <h1 className="Title">Settings<i className="fas fa-cog"></i></h1>
        <div className="fade settings">
          <div id="profileParent">
            <div id="profile">
              <i className="fas fa-user-circle"></i><h3>{this.state.firstNameReceived}</h3>
            </div>
            <button className="waves-effect waves-light btn" onClick={this.logout}>Log out</button>
          </div>
          <div id="table">
            <div className="row">
              <div>
                <p>Name</p>
                <h4>{this.state.firstNameReceived} {this.state.lastNameReceived}</h4>
              </div>
            </div>
            <div className="row">
              <div>
                <p>Email</p>
                <h4>{this.state.email}</h4>
              </div>
            </div>
          </div>
          <ul className="collapsible">
            <li>
              <div className="collapsible-header"><i className="material-icons">email</i>Update Email</div>
              <div className="collapsible-body">
                <div className="input-field ">
                    <input id="new_email" type="email" onChange={this.updateInput} value={this.state.new_email}></input>
                    <label htmlFor="email">New Email</label>
                </div>
                <div className="input-field">
                  <label htmlFor="password">Password</label>
                  <input id="password" type="password" value={this.state.password} onChange={this.updateInput} ></input>
                </div>
                <button className="waves-effect waves-light btn" onClick={this.updateEmail} >Save</button>
                </div>
            </li>
            <li>
              <div className="collapsible-header"><i className="material-icons">person</i>Update Name</div>
              <div className="collapsible-body">
                  <div className="input-field ">
                      <input id="firstName" type="text" value={this.state.firstName} onChange={this.updateInput}></input>
                      <label htmlFor="firstName" >New First Name</label>
                  </div>
                  <div className="input-field ">
                      <input id="lastName" type="text" value={this.state.lastName} onChange={this.updateInput}></input>
                      <label htmlFor="lastName">New Last Name</label>
                  </div>
                  <button className="waves-effect waves-light btn" onClick={this.updateProfile}>Save</button>
              </div>
            </li>
            <li>
                <div className="collapsible-header"><i className="material-icons">security</i>Update Password</div>
                <div className="collapsible-body">
                <p>Click the button below to receive an email with a link to reset your password.</p>
                <button className="waves-effect waves-light btn" onClick={this.updatePassword} >Send Email</button>
              </div>
            </li>
            <li>
              <div className="collapsible-header"><i className="material-icons">delete</i>Delete Account</div>
              <div className="collapsible-body">
              <p>If you are sure you want to delete your account, enter your password below. (This action cannot be undone).</p>
                <div style={{textAlign: "left"}}>
                    <label htmlFor="password">Enter your password</label>
                      <input id="password" type="password" value={this.state.password} onChange={this.updateInput}></input>
                      
                </div>
                <button className="waves-effect waves-light btn" onClick={this.deleteAccount}>Delete Account</button>
                </div>
            </li>
          </ul>
        </div>
      </>
    )
  }
}

const mapStateToProps = state => {
  return {
    id: state.user.id,
    email: state.user.email
  }
}

const mapDispatchToProps = dispatch => {
  return {
    logout: () => dispatch(actions.logout())
  }
}


export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Settings));
