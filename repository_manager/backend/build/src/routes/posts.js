import { Router } from 'express';
import * as yup from 'yup';
import { v4 as uuidv4 } from 'uuid';
import { rw, r } from '../lib/drivers/database.js';
import { postSchema } from '../models/post.js';
import { authorizedPk, web3Auth } from '../middleware/auth/web3Auth.js';
const postsRouter = Router();
postsRouter.get('/', web3Auth({ action: 'posts:get-all', allowSkipCheck: true }), async (_req, res) => {
    const pk = authorizedPk(res);
    // this needs to be changed so that the data is fetched using gun.js also
    const posts = await r((db) => db.data.posts.filter(({ userId }) => userId === pk));
    res.status(200).send({ data: { posts } });
    return;
});
postsRouter.get('/:postId', web3Auth({ action: 'posts:get-one', allowSkipCheck: true }), async (req, res) => {
    const pk = authorizedPk(res);
    const { postId } = req.params;
    const post = await r((db) => db.data.posts.find((post) => post.id === postId) ?? null);
    if (!post) {
        res.status(404).send({
            error: {
                message: 'Post not found',
            },
        });
        return;
    }
    if (post.userId !== pk) {
        res.status(403).send({
            error: {
                message: 'Forbidden',
            },
        });
        return;
    }
    res.status(200).send({
        data: {
            post,
        },
    });
    return;
});
postsRouter.post('/', web3Auth({ action: 'posts:post' }), async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const body = await postSchema.validate(req.body);
        const post = {
            id: uuidv4(), // giving a uuid as the title of the post
            title: body.title,
            content: body.content,
            userId: pk,
        };
        await rw((db) => db.data.posts.push(post));
        res.status(200).send({ data: { post } });
        return;
    }
    catch (error) {
        if (yup.ValidationError.isError(error)) {
            res.status(400).send({ error: { message: error.message } });
            return;
        }
        else {
            res.status(500).send({ error: { message: 'Unhandled error.' } });
            return;
        }
    }
});
postsRouter.put('/:postId', web3Auth({ action: 'posts:put' }), async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { postId } = req.params;
        const body = await postSchema.validate(req.body);
        const post = await rw((db) => {
            const match = db.data.posts.find(({ id }) => id === postId);
            if (!match) {
                throw new Error('Post not found');
            }
            if (match.userId !== pk) {
                throw new Error('Forbidden');
            }
            match.title = body.title;
            match.content = body.content;
            return match;
        });
        res.status(200).send({ data: { post } });
        return;
    }
    catch (error) {
        if (yup.ValidationError.isError(error)) {
            res.status(400).send({ error: { message: error.message } });
            return;
        }
        else {
            res.status(500).send({ error: { message: 'Unhandled error.' } });
            return;
        }
    }
});
postsRouter.delete('/:postId', web3Auth({ action: 'posts:delete' }), async (req, res) => {
    try {
        const pk = authorizedPk(res);
        const { postId } = req.params;
        const post = await rw((db) => {
            const match = db.data.posts.find(({ id }) => id === postId);
            if (!match) {
                throw new Error('Post not found');
            }
            if (match.userId !== pk) {
                throw new Error('Forbidden');
            }
            db.data.posts = db.data.posts.filter(({ id }) => id !== postId);
            return match;
        });
        res.status(200).send({ data: { post } });
        return;
    }
    catch (error) {
        if (yup.ValidationError.isError(error)) {
            res.status(400).send({ error: { message: error.message } });
            return;
        }
        else {
            res.status(500).send({ error: { message: 'Unhandled error.' } });
            return;
        }
    }
});
export { postsRouter };
