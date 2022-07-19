import { Button, Snackbar, TextField } from '@material-ui/core'
import { Form, Formik } from 'formik'
import React, { useState } from 'react'
import GoogleLogin from 'react-google-login'
import Fade from 'react-reveal/Fade'
import { RouteComponentProps } from 'react-router-dom'
import ClipLoader from 'react-spinners/ClipLoader'
import * as yup from 'yup'
import AuthenticationService from '../../services/auth-service'
import './Login.scss'

interface FormInputs {
  email: string
  password: string
}

const validationSchema = yup.object({
  email: yup
    .string()
    .email('Enter a valid email.')
    .required('Email is required.'),
  password: yup
    .string()
    .required('Password is required.')
})

const Login = (props: RouteComponentProps) => {
  const [loading, setLoading] = useState(null)
  const [signInError, setSignInError] = useState(null)
  const [snackBarOpen, setSnackBarOpen] = useState(null)
  const [snackBarMessage, setSnackBarMessage] = useState(null)
  const [googleLoginHidden, setGoogleLoginHidden] = useState(false)

  const openSnackBar = (message: string): void => {
    setSnackBarOpen(true)
    setSnackBarMessage(message)
  }

  const closeSnackBar = (): void => {
    setSnackBarOpen(false)
    setSnackBarMessage('')
  }

  const sendPasswordResetLink = async (email: string): Promise<void> => {
    try {
      const res = await AuthenticationService.getPasswordResetLink(email)
      res.data.success
        ? openSnackBar('Check the provided email for a link to reset your password.')
        : openSnackBar('There was an error.')
    } catch (err) {
      console.log(err)
      openSnackBar('There was an error.')
    }
  }

  const authenticateWithGoogle = async (response) => {
    try {
      const res = await AuthenticationService.signInWithGoogle(response.tokenId)
      if (res.data.success) {
        AuthenticationService.setUserLoggedIn()
        props.history.push('/recipes')
      } else {
        openSnackBar(res.data.message)
        setSignInError(true)
      }
    } catch (err) {
      console.log(err)
      openSnackBar(err.data ? err.data.message : 'Could not authenticate.')
      setSignInError(true)
    }
  }

  const signin = async (data: FormInputs) => {
    setLoading(true)
    try {
      const res = await AuthenticationService.signIn(data.password, data.email)
      if (res.data?.success) {
        AuthenticationService.setUserLoggedIn()
        props.history.push('/recipes')
      } else {
        setLoading(false)
        setSignInError(true)
        openSnackBar(res.data.message)
      }
    } catch (err) {
      console.log(err)
      openSnackBar(err.response.data?.error || 'There was an error.')
      setSignInError(true)
      setLoading(false)
    }
  }

  const handleGoogleLoginFailure = (error) => {
    console.log(error)
    setGoogleLoginHidden(true)
  }

  return (
    <>
      <div className="auth">
        <div className="gradient">
          <Fade top>
            <Formik
              initialValues={{
                email: '',
                password: ''
              }}
              validationSchema={validationSchema}
              onSubmit={(values) => signin(values)}
              render={formik => (
              <Form>
                <h1>Login</h1>
                <TextField
                  label="Email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                  onBlur={formik.handleBlur}
                  type="email"
                  name="email"/>
                <TextField
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  error={formik.touched.password && Boolean(formik.errors.password)}
                  helperText={formik.touched.password && formik.errors.password}
                  onBlur={formik.handleBlur}
                  type="password"
                  label="Password"
                  name="password"/>
                <div className="buttons">
                  <Button
                    type="submit"
                    variant="outlined"
                    color="secondary"
                    disabled={!formik.isValid}>
                    { loading
                      ? <ClipLoader
                        css={'border-color: white;'}
                        size={30}
                        color={'#689943'}
                        loading={loading}/>
                      : 'Submit' }
                  </Button>

                  { !googleLoginHidden ? <GoogleLogin
                    className="googleButton"
                    clientId={process.env.GOOGLE_LOGIN_CLIENT_ID}
                    buttonText="Login with Google"
                    onSuccess={authenticateWithGoogle}
                    onFailure={handleGoogleLoginFailure}
                    cookiePolicy={'single_host_origin'}
                  /> : null }

                  { signInError
                    ? (
                    <Button
                      variant="contained"
                      onClick={() => sendPasswordResetLink(formik.values.email)}
                      color="primary"
                    >
                      Reset Password
                    </Button>
                      )
                    : null }
                  </div>
              </Form>
              )}>
              </Formik>
          </Fade>
        </div>
      </div>

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
export default Login
