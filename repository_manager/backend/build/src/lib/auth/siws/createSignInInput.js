// the sign in input needs to be generated from the backend itself
// Debashish Buragohain
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
export const createSignInData = async (expiryInMins = 10) => {
    const now = new Date();
    const uri = process.env.href;
    const currentUrl = new URL(uri);
    const domain = currentUrl.host;
    // default expiry time for phantom is 10 mins
    const expirationTime = DateTime.local().toUTC().plus({ minutes: expiryInMins }).toISO();
    // convert the date object into a string
    const currentDateTime = now.toISOString();
    // so the signInData can be kept empty in most cases: all fields are optional
    // this will create the fields and additional fields when we sign in using Phantom    
    const signInData = {
        // address not provided, the wallet determines it itself
        uri,
        domain,
        statement: "Clicking Sign or Approve only means you have proved this wallet is owned by you. This request will not trigger any blockchain transaction or cost any gas fee.",
        version: "1", // current version for the message which must be 1 for this specification
        nonce: uuidv4(), // random alphanumeric nonce based on UUID
        chainId: 'mainnet', // chainid is always a string like this
        issuedAt: currentDateTime,
        expirationTime,
        resources: ['https://phantom.com/learn/developers/sign-in-with-solana', 'https://phantom.app/']
    };
    return signInData;
};
