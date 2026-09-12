const crypto = require('crypto')

if (typeof crypto.getRandomValues !== 'function' && crypto.webcrypto) {
  crypto.getRandomValues = crypto.webcrypto.getRandomValues.bind(crypto.webcrypto)
}

if (!globalThis.crypto && crypto.webcrypto) {
  globalThis.crypto = crypto.webcrypto
}
