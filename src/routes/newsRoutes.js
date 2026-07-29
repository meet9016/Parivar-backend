const express = require('express');
const { protect, requirePermission, getTokenFromRequest } = require('../middleware/auth');
const { postUpload } = require('../middleware/upload');
const { getNewsList, getNewsById, addNews, updateNews, deleteNews } = require('../controllers/newsController');

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

router.get('/', getNewsList);

router.post('/', protect, postUpload, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('news.add')(req, res, () => addNews(req, res, next));
    }
    return addNews(req, res, next);
});

router.put('/:id', protect, postUpload, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('news.edit')(req, res, () => updateNews(req, res, next));
    }
    return updateNews(req, res, next);
});

router.delete('/:id', protect, (req, res, next) => {
    if (isAdminCall(req)) {
        return requirePermission('news.delete')(req, res, () => deleteNews(req, res, next));
    }
    return deleteNews(req, res, next);
});

// Legacy member routes that include /news
router.get('/news', protect, getNewsList);
router.get('/news/:id', protect, getNewsById);
router.post('/news', protect, postUpload, addNews);
router.put('/news/:id', protect, postUpload, updateNews);
router.delete('/news/:id', protect, deleteNews);

module.exports = router;
