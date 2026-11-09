/**
 * Joi validation middleware wrapper.
 * Usage: validate(schema, 'body') or validate(schema, 'query')
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    req[property] = value;
    next();
  };
}

module.exports = validate;
