import { Router } from 'express'
import client from './client'
import nodemailer from 'nodemailer'
const sgTransport = require('nodemailer-sendgrid-transport')
const crypto = require('crypto')
const router = Router()

const environment = process.env.NODE_ENV || 'development'

if (environment === 'development') {
  require('dotenv').config({
    path: './.env.development'
  })
}

router.post('/', (request: any, response, next) => {
  const { email } = request.body
  if (!email) {
    return response.status(400).json({ success: false, message: 'Invalid request sent.' })
  }
  client.query('SELECT * FROM users WHERE email=$1',
    [email],
    (err, res) => {
      if (err) return next(err)
      if (res.rows) {
        // generate unique hash token
        const token = crypto.randomBytes(20).toString('hex')
        const expiration = Date.now() + 3600000
        // store the token in the reset_password_token column of the users table
        // also store when it expires in the reset_password_expires column
        client.query('UPDATE users SET reset_password_token=$1, reset_password_expires=$2 WHERE email=$3',
          [token, expiration, email],
          (err, res) => {
            if (err) return next(err)
            if (res.rowCount) {
            // now create  transport, which is actually the account sending the password reset email link
              const options = {
                auth: {
                  api_key: `${process.env.SENDGRID_API_KEY}`
                }
              }
              const mailer = nodemailer.createTransport(sgTransport(options))
              const emailToSend = {
                from: 'virtualcookbook@outlook.com',
                to: `${email}`,
                subject: 'Reset Password Link',
                html: `<h1>recipe stash</h1><p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p> \n\n <a href="${process.env.PROJECT_URL}reset/${token}" ><button>Reset Password</button></a>\n\n <p>If you did not request this, please ignore this email and your password will remain unchanged.\n</p>`
              }
              mailer.sendMail(emailToSend, function (err, _) {
                if (err) {
                  return response.status(500).json({ success: false, message: 'There was an error sending the email.', error: err.message, name: err.name })
                } else {
                  request.session.destroy()
                  return response.status(200).json({ success: true })
                }
              })
            } else {
              return response.status(200).json({ success: true })
            }
          })
      }
    })
})

router.get('/:token', (request, response, next) => {
  const token = request.params.token
  client.query('SELECT email, reset_password_token, reset_password_expires FROM users WHERE reset_password_token=$1',
    [token],
    (err, res) => {
      if (err) return next(err)
      if (res.rows.length && res.rows[0].reset_password_token && res.rows[0].reset_password_expires) {
        const now = Date.now()
        if (res.rows[0].reset_password_expires > now) {
          return response.status(200).send({
            success: true,
            message: 'Password reset link is valid.',
            user_email: res.rows[0].email
          })
        } else {
          return response.status(403).send({ message: 'The token is expired.' })
        }
      } else {
        return response.status(403).send({ message: 'No user could be found with that token.' })
      }
    })
})

export default router
