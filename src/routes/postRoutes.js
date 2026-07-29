const express = require('express');
const { protect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { postUpload, parseForm } = require('../middleware/upload');
const { savePost, getPosts, getPostById, deletePost } = require('../controllers/postController');

const router = express.Router();

const optionalProtect = async (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (token) {
        return protect(req, res, next);
    }
    return next();
};

const isAdminCall = (req) => {
    return req.user && (req.user.is_committee || req.user.role_id || req.user.role === 'admin');
};

router.get('/', protect, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('posts.list')(req, res, () => getPosts(req, res, next));
    }
    return getPosts(req, res, next);
});

router.post('/', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('posts.add')(req, res, () => savePost(req, res, next));
    }
    return savePost(req, res, next);
});

router.put('/:id', protect, parseForm, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('posts.edit')(req, res, () => savePost(req, res, next));
    }
    return savePost(req, res, next);
});

router.delete('/:id', protect, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('posts.delete')(req, res, () => deletePost(req, res, next));
    }
    return deletePost(req, res, next);
});

// Member legacy routes
router.post('/posts', protect, postUpload, savePost);
router.post('/add_post', protect, postUpload, savePost);
router.put('/posts/:id', protect, postUpload, savePost);
router.put('/add_post/:id', protect, postUpload, savePost);
router.get('/posts', protect, getPosts);
router.get('/all_post_list', protect, getPosts);
router.post('/all_post_list', protect, getPosts);
router.get('/posts/:id', protect, getPostById);
router.delete('/posts/:id', protect, deletePost);

module.exports = router;
