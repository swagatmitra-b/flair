/**
 * This authentication middleware is used to verify
 * that the request is signed by the owner of the public key.
 * It uses an authorization header with the following format:
 * `Authorization: Bearer pk.msg.sig`
 * Where pk is the base58-encoded public key, msg is the base58-encoded message,
 * and sig is the base58-encoded signature.
 * This middleware does not validate the lifetime of the signature or the
 * contents of the message.
 */
// the default sign in context
export const signInContext = { allowSkipCheck: true, action: 'signin' };
// the create tree message signing constant
export const createTreeContext = { allowSkipCheck: false, action: 'createTree' };
