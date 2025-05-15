// Solana Wallet Authenticated routing backend
// Debashish Buragohain
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { signInContext } from './middleware/auth/index.js';
import { authHandler
// ByPassAuth
 } from './middleware/auth/index.js';
import { authRouter, repoRouter, treeRouter, backendWalletRouter, userRouter } from './routes/index.js';
const app = express();
// Middleware
app.use(morgan('combined'));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
app.use(cors());
app.use(express.json());
// trust the proxy
app.set('trust proxy', true);
app.use('/auth', authRouter);
app.use('/user', authHandler(signInContext), userRouter);
// authorized routes
app.use('/repo', 
// uncomment this when you want to bypass authentication
// ByPassAuth(signInContext),
authHandler(signInContext), repoRouter);
// backend wallet is restricted to be accessed only from localhost
app.use('/systemWallet', authHandler(signInContext), 
// restrictToLocalHost,       uncomment to restrict this route only to the local host
backendWalletRouter);
// for the tree route we need to attach the middlewares on individual routes
app.use('/tree', treeRouter);
// Handle 404
app.all('*', (req, res, next) => {
    res.status(404).send({ error: '404 Not Found' });
});
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
