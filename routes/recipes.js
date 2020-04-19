const { Router } = require('express');
const client = require('../db');
const router = Router();

router.get('/:id', (request, response, next) => {
  const { id } = request.params;
  client.query('SELECT * FROM recipes WHERE user_id=$1',
  [id],
   (err, res) => {
    if (err) return next(err);
    response.json(res.rows)
  });
});

module.exports = router;
