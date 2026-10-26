/** Error carrying an HTTP status; turned into JSON by the error handler in index.js. */
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

module.exports = { HttpError, str };
