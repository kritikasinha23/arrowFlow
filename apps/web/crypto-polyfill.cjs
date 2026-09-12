const crypto = require("crypto");
const { webcrypto } = crypto;
if (webcrypto) {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    globalThis.crypto = webcrypto;
  }
  if (typeof crypto.getRandomValues !== "function") {
    crypto.getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
  }
}
