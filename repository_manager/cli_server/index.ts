// the cli is going to have an endpoint where it receives the tokens from the frontend
// this is that endpoint
// Debashish Buragohain

import express, { Request, Response } from 'express';
import { MemoryStoredTokenGen } from './src/auth/general.js';
import { MemoryStoredTokenSiws } from './src/auth/siws.js';
import cors from 'cors';
import { SolanaSignInInput, SolanaSignInOutput } from '@solana/wallet-standard-features';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
// Parse incoming JSON bodies
app.use(express.json());

// Define the POST /authToken endpoint
app.post('/authToken', (req: Request, res: Response) => {
    try {
        console.log(req.body);
        let { authToken, wallet } = req.body as { authToken?: string, wallet?: string };
        // Check if authToken is provided
        if (!authToken) {
            res.status(400).send('authToken is required in the request body.');
            return;
        }
        if (!wallet) {
            res.status(400).send('public key is required in the request body.');
            return;
        }
        if (!authToken.includes('siws') && !authToken.includes('universal')) {
            res.status(400).send('Invalid authToken');
            return;
        }

        // display the wallet and the curren token into the cli
        console.log('Wallet signed in:', wallet);
        console.log(`Token received from frontend: ${authToken}`);

        if (authToken.includes('siws')) {
            authToken = authToken.replace('siws', '');      // replace the siws header from the token
            const decodedString = Buffer.from(authToken, 'base64').toString('utf-8');
            const parsedToken = JSON.parse(decodedString);
            const input = parsedToken.input as SolanaSignInInput;
            const output = parsedToken.output as SolanaSignInOutput;
            MemoryStoredTokenSiws.getInstance().setAuth(input, output, wallet);            
            console.log('SIWS input token:', input);
            console.log('SIWS output token:', output);
            res.status(200).json({ success: true });
            return;
        }
        if (authToken.includes('universal')) {
            authToken = authToken.replace('universal', '');  // replaces the universal header from the token            
            MemoryStoredTokenGen.getInstance().setToken(authToken, wallet);
            res.status(200).json({success: true});
            return;
        }
        res.status(200).send({ success: true });
        return;
    }
    catch (err) {
        console.error('Error signing in:', err);
        res.status(500).send(`Error in authentication: ${err}`);
        return;
    }
});

// Start the server on port 4200
app.listen(process.env.PORT, () => {
    console.log('CLI Server listening on port', process.env.PORT);
});

// sample request example --> uncomment this and use this section anywhere in your code
// import { request } from './src/requests';
// (async () => {
    
//     // sample GET request
//     await request({
//         method: 'GET',
//         url: 'http://localhost:4000/repo',  // there are some routes that need the action body to be different from the 'signin'.
//         action: 'signin'                    // by default the action is set to sign in only
//      });


//      // sample POST request
//      await request({
//         method: 'POST',
//         url: 'http://localhost:4000/repo/create',
//         data: JSON.stringify({})
//      })
// })();