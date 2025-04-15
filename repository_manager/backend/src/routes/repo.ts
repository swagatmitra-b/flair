import { prisma } from '../lib/prisma';
import { Router } from 'express';
import { authHandler, authorizedPk } from '../middleware/auth';
import { signInContext } from '../middleware/auth/context';

const repoRouter = Router();

// get all the repositories for the particular user
repoRouter.get('/', authHandler(signInContext),
    async (req, res) => {
        // extract the authorized public key
        const pk = authorizedPk(res);
        prisma.repository.findMany({
            where: {
                creator: pk
            },
            include: {
                branches: {
                    include: {
                        commits: true
                    }
                }
            }
        }).then(repos => {
            res.status(200).json({ data: repos });
        }).catch(err => {
            res.status(400).send({ error: err });
        })
    });

repoRouter.post('/create', authHandler(signInContext),
    async (req, res) => {
        // create a repository
        const pk = authorizedPk(res);

    })