
const { Router, response } = require('express')
const client = require('../db')
const router = Router()
const aws = require('aws-sdk')
const { v4: uuidv4 } = require('uuid');
const multer = require('multer')
const multerS3 = require('multer-s3')
const authMiddleware = require('./authMiddleware.js')
const environment = process.env.NODE_ENV || 'development';

if (environment === 'development') {
    require('dotenv').config({
      path: '../.env'
    })
  }

aws.config.update({
    secretAccessKey: process.env.S3_ACCESS_SECRET, 
    accessKeyId: process.env.S3_ACCESS_KEY_ID, 
    region: 'us-east-2'
})

const s3 = new aws.S3()

const upload = multer({
    storage: multerS3({
        s3, 
        bucket: 'virtualcookbook-media',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req, file, cb) {
            cb(null, {fieldName: file.fieldname})
        }, 
        key: function (req, file, cb) {
            cb(null, req.s3Key)
        }
    })
})
const singleFileUpload = upload.single('image')

function uploadToS3(req, res) {
    req.s3Key = uuidv4()
    let downloadUrl = `https://s3-us-east-2.amazonaws.com/virtualcookbook-media/${req.s3Key}`
    return new Promise((resolve, reject) => {
        return singleFileUpload(req, res, err => {
            if (err) return reject(err)
            return resolve({downloadUrl, key: req.s3Key})
        }) 
    })
}

router.use(authMiddleware)

router.post('/:recipeId', authMiddleware, (req, res) => {
    const { recipeId } = req.params
    let userId = req.userID
    uploadToS3(req, res)
    .then(awsUploadRes => {
        client.query('INSERT INTO files(aws_download_url, recipe_id, user_id, key) VALUES($1, $2, $3, $4)', 
        [awsUploadRes.downloadUrl, recipeId, userId, awsUploadRes.key],
        (error, response) => {
            if (error) return res.status(500).json({ success: false, message: `There was an error: ${error}`})
            if (response.rowCount) {
                client.query('UPDATE recipes SET has_images = TRUE WHERE id = $1', 
                    [recipeId], 
                    (error, response) => {
                        if (error) return res.status(500).json({ success: false, message: `There was an error: ${error}`}) 
                        if (response.rowCount) {
                            return res.status(200).json({ success: true, url: awsUploadRes.downloadUrl })
                        }
                    })
            }
        })
    })
    .catch(e => {
        console.log(e)
    })
})

getPresignedUrls = async(image_uuids) => {
    return new Promise((resolve, reject) => {
        let presignedUrls = []
        for (let i = 0; i < image_uuids.length; i ++) {
            s3.getSignedUrl(
                'getObject', 
                {
                    Bucket: 'virtualcookbook-media', 
                    Key: image_uuids[i]
                }, 
                (err, url) => {
                    if (err) return
                    presignedUrls.push(url)
                }
            )

            if (i === image_uuids.length-1) {
                return resolve(presignedUrls)
            }
        }
    })
}

router.post('/', authMiddleware, (req, res) => {
    // generate presigned url 
    const image_uuids = req.body.image_urls
    getPresignedUrls(image_uuids)
    .then(presignedUrls => {
        res.status(200).json({presignedUrls})
    })
    .catch(err => console.log(err))
})

router.get('/:UUID', authMiddleware, (req, res) => {
    // generate presigned url 
    const UUID = req.params.UUID
    s3.getSignedUrl(
        'getObject', 
        {
            Bucket: 'virtualcookbook-media', 
            Key: UUID
        }, 
        (err, url) => {
            if (err) return res.status(500).json({ success: false, message: `Error getting the url: ${err}`})
            return res.status(200).json({success: true, url})
        }
    )
})

router.delete('/:imageKey', authMiddleware, (req, res) => {
    const { imageKey } = req.params
    s3.deleteObject({
        Bucket: 'virtualcookbook-media',
        Key: imageKey
    }, (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'File could not be deleted from AWS.'})
        } else {
            client.query('DELETE FROM files WHERE key=$1 RETURNING recipe_id', 
                [imageKey],
                (error, response) => {
                    if (error) return res.status(500).json({ success: false, message: `There was an error: ${error}`})
                    // set recipe's "has_images" property to false if necessary
                    let recipeId = response.rows[0] ? response.rows[0].recipe_id : null 
                    if (recipeId) {
                    client.query('SELECT * FROM files WHERE recipe_id=$1', 
                    [recipeId],
                    (error, response) => {
                        if (error) return res.status(500).json({ success: false, message: `There was an error: ${error}`})
                        if (response.rowCount) {
                            return res.status(200).json({ success: true, message: 'File deleted.' })
                        } else {
                            // mark has_images to false 
                            client.query('UPDATE recipes SET has_images = FALSE WHERE id = $1', 
                            [recipeId], 
                            (error, response) => {
                                if (error) return res.status(500).json({ success: false, message: `There was an error: ${error}`}) 
                                if (response.rowCount) {
                                    return res.status(200).json({ success: true, message: 'File deleted.' }) 
                                }
                            })
                        }
                    })
                } else {
                    return res.status(200).json({ success: true}) 
                }
                })
        }
    })
})

module.exports = router;