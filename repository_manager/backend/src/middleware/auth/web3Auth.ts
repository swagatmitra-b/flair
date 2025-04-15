// middleware to check if the request has a valid signature of the wallet
// Debashish Buragohain

import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { Response, RequestHandler } from 'express';
import b58 from 'bs58';
import { DateTime } from 'luxon';

/**
 * Configuration context that is passed to the middleware via
 * function currying, this allows for several configurations
 * to modify how the validations are performed.
 */

type Web3AuthConfigurationContext = {
  /**
   * The action field is the name of the action that is being performed.
   * This is used to determine the signed message is correct, and also specifies
   * a persmission from the client to perform an activity.
   * If action is `"skip"`, and the handler is configured to `allowSkipCheck = true`, then
   * the check will be skipped, which is useful for JWT-Like authentication
   * on several types of endpoints (Like reading).
   */
  action: string;
  /**
   * If set to `true`, the current execution context will allow for an action
   * to be "skip", skipping the action check if the endpoint allows for it.
   */
  allowSkipCheck?: boolean;
};

type Web3AuthHandlerCreator = (
  ctx: Web3AuthConfigurationContext,
) => RequestHandler;

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


type extrcatedABNF = {
  action: string,
  expiryTime: string
}
const extractFromABNF = (message: string): extrcatedABNF => {
  const msgArray = message.split('\n');
  let action = '';
  let expiryTime = '';
  for (const field of msgArray) {
    if (field.includes('Action:')) {
      const [, extractedAction] = field.split(' ');
      action = extractedAction;
    }
    if (field.includes('Expiration Time:')) {
      const [, extractedExpiry] = field.split(' ');
      expiryTime = extractedExpiry;
    }
  }
  return { action, expiryTime };
}

// not just the validity of the signature but also its expiry and if the signature matches the action
export const web3Auth: Web3AuthHandlerCreator = (ctx) => (req, res, next) => {
  const { allowSkipCheck } = ctx;
  const givenAction = ctx.action;
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    res
      .status(401)
      .send({ error: { message: 'Missing Authorization header' } });
    return;
  }
  const [, authToken] = authHeader.split(' ');
  const [pk, msg, sig] = authToken.split('.');

  // first step is to verify the signature
  // verifiying the hash here
  const hasValidSig = nacl.sign.detached.verify(
    b58.decode(msg),
    b58.decode(sig),
    new PublicKey(pk).toBytes(),
  );

  if (!hasValidSig) {
    res.status(401).send({ error: { message: 'Invalid signature' } });
    return;
  }

  // extract the action and expiry components here itself

  // if signature valid then check whether the token is expired or not
  // const contents = JSON.parse(new TextDecoder().decode(b58.decode(msg))) as {
  //   action: string;
  //   exp: number;
  // };
  const { action, expiryTime } = extractFromABNF(msg);

  if (Date.now() > new Date(expiryTime).getMilliseconds()) {
    res.status(401).send({ error: { message: 'Expired signature' } });
    return;
  }

  const skipActionCheck = allowSkipCheck && action === 'signin';
  console.log('💎', {
    action,
    allowSkipCheck,
    skipActionCheck,
  });

  // the skip action check is the last check and checks whether the action that has been signed matches the action that is provided to be performed
  // skip action check skips this action though. so we can essentially do a skip action on every action, but we have allowed the skip action to be
  // available only for the GET request from the server.
  if (!skipActionCheck && action !== givenAction) {
    res.status(401).send({ error: { message: 'Invalid action' } });
    return;
  }

  // if authorized, store the authorized public key in the local property of the response
  res.locals.pubKey = pk;
  next();
};

// extract the authoorized public key that is stored in the locals property
export const authorizedPk = (res: Response) => res.locals.pubKey as string;



