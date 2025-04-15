// chooses which authentication method needs to be used
// the index file determines which authentication method is chosen and passes the function to that
// Debashish Buragohain
import { Web3AuthHandlerCreator } from "./context";
import { siwsAuth } from "./siwsAuth";
import { web3Auth } from "./web3Auth";

import { authorizedPk } from "./web3Auth";

export const authHandler: Web3AuthHandlerCreator = (ctx) => (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        res.status(401)
            .send({ error: { message: 'Missing Authorization header' } });
        return;
    }
    // check which of the authentication mechanisms are we going for
    if (authHeader.includes('universal')) {
        web3Auth(ctx);
    }
    else if (authHeader.includes('siws')) {
        siwsAuth(ctx);
    }
    else res.status(400).send({ error: { message: 'Invalid sign in strategy.' } });
}


// both the public key functions from both strategies do exactly the same thing so it make sense to use any of them
export { authorizedPk };