// Solana Wallet Authenticated routing backend
// Debashish Buragohain
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { createTreeContext, signInContext } from './middleware/auth/index.js';
import { authHandler } from './middleware/auth/index.js';
import { authRouter, repoRouter, treeRouter } from './routes/index.js';
const PORT = process.env.PORT;
const app = express();
// Middleware
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());
// SIWS authentication implemented at this position
app.use('/auth', authRouter);
// authorized routes
app.use('/repo', 
// uncomment this when you want to bypass authentication
// ByPassAuth(signInContext),
authHandler(signInContext), repoRouter);
// tree route must be general authenticated
app.use('/tree', authHandler(createTreeContext), 
// uncomment this when you want to bypass authentication
// ByPassAuth(signInContext),
treeRouter);
// Handle 404
app.all('*', (req, res, next) => {
    res.status(404).send({ error: '404 Not Found' });
});
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
