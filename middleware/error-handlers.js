// Koodissa hyödynnetty tekoälyä Claude Sonnet v4.6 koodin rakentamiseen ja tarkistamiseen, sekä ymmärtämiseen

import {validationResult} from 'express-validator';

/**
 * Middleware syötteiden validointivirheiden käsittelyyn.
 * Tarkistaa express-validatorin tulokset ja välittää virheet errorHandlerille.
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const validationErrorHandler = (req, res, next) => {
  // Tarkistetaan vain request bodyn validointivirheet
  const errors = validationResult(req, {strictParams: ['body']});

  if (!errors.isEmpty()) {
    const error = new Error('Bad Request');
    error.status = 400;
    // Muotoillaan virheet {field, message}-muotoon, yksi virhe per kenttä
    error.errors = errors.array({onlyFirstError: true}).map((error) => ({
      field: error.path,
      message: error.msg,
    }));
    return next(error);
  }

  next();
};

/**
 * Middleware tuntemattomille reiteille (404).
 * Kutsutaan kun mikään reitti ei täsmää pyyntöön.
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

/**
 * Yleinen virheenkäsittelijä kaikille Express-virheille.
 * Palauttaa virheen tiedot JSON-muodossa.
 * @param {Error} err - Virhe, sisältää status, message ja mahdolliset errors-kentät
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
      errors: err.errors || '',
    },
  });
};

export {validationErrorHandler, notFoundHandler, errorHandler};
