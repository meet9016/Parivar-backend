const mongoose = require('mongoose');
const Post = require('../models/postModel');
const { apiResponse, fullName, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const imageFromRequest = (req, fallback = '') => {
  if (req.file) return `/uploads/${req.file.filename}`;
  if (req.body.remove_image === 'true') return '';
  return req.body.image || fallback || '';
};
const createdBy = (req) => {
  const user = req.user || {};
  const name = fullName(user) || user.name || user.username || user.email || '';
  const id = user._id || user.id || '';
  return { id, name };
};

const tenantStatusQuery = () => ({
  $or: [{ status: 2 }, { status: 1 }, { status: { $exists: false } }]
});

const getPosts = async (req, res) => {
  try {
    const isCommitteeOrAdmin = req.user && (req.user.is_committee || req.user.role === 'admin' || req.user.relation === 'Self');
    let posts, pagination;

    if (isCommitteeOrAdmin) {
      ({ data: posts, pagination } = await queryHelper(Post, req.query, {
        searchFields: ['title', 'description', 'created_by.name'],
        filterFields: ['status', 'country_id', 'state_id', 'city_id'],
        defaultSort: { createdAt: -1, _id: -1 }
      }));
    } else {
      ({ data: posts, pagination } = await queryHelper(Post, req.query, {
        baseQuery: {
          $and: [{
            $or: [tenantStatusQuery(), { 'created_by.id': req.user?._id }]
          }]
        },
        searchFields: ['title', 'description', 'created_by.name'],
        filterFields: ['status', 'country_id', 'state_id', 'city_id'],
        defaultSort: { createdAt: -1, _id: -1 }
      }));
    }

    const data = posts.map((post) => ({
      id: post._id,
      created_by: post.created_by || {},
      title: post.title || '',
      description: post.description || '',
      image: publicUrl(req, post.image || ''),
      cdate: post.cdate || (post.createdAt ? new Date(post.createdAt).toISOString().slice(0, 10) : ''),
      date: post.cdate || (post.createdAt ? new Date(post.createdAt).toISOString().slice(0, 10) : ''),
      status: Number(post.status ?? 1),
      is_own: String(req.user?._id) === String(post.created_by?.id)
    }));

    return apiResponse(res, 200, 'Posts retrieved successfully', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving posts', { error: error.message });
  }
};

const getPostById = async (req, res) => {
  try {
    const id = req.params.id || req.query.id;
    const post = await Post.findOne(
      mongoose.isValidObjectId(id) ? { _id: id } : { id: String(id) }
    ).lean();
    if (!post) return apiResponse(res, 404, 'Post not found');
    return apiResponse(res, 200, 'Post retrieved successfully', {
      _id: post._id || '',
      created_by: post.created_by || {},
      title: post.title || '',
      description: post.description || '',
      image: publicUrl(req, post.image || ''),
      cdate: post.cdate || '',
      status: Number(post.status ?? 1),
      is_own: String(req.user?._id) === String(post.created_by?.id)

    });
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving post', { error: error.message });
  }
};

const savePost = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    const { title, description } = req.body;
    const status = req.body.status;

    if (!title || !description) {
      return apiResponse(res, 400, 'Post title and description are required');
    }

    const existing = id
      ? await Post.findOne({
        $or: [{ id: String(id) }, { _id: mongoose.isValidObjectId(id) ? id : undefined }]
      })
      : null;

    if (id && !existing) return apiResponse(res, 404, 'Post not found or unauthorized');

    const isCommitteeOrAdmin = req.user && (req.user.is_committee || req.user.role === 'admin' || req.user.relation === 'Self');

    if (existing && !isCommitteeOrAdmin && String(existing.created_by?.id) !== String(req.user?._id)) {
      return apiResponse(res, 403, 'Unauthorized to edit this post');
    }

    const post = existing || new Post({
      id: `POST${Date.now()}`,
      created_by: createdBy(req),
      cdate: new Date().toISOString().slice(0, 10)
    });

    post.title = title;
    post.description = description;


    if (!existing) {
      post.created_by = createdBy(req);
    } else if (!post.created_by?.name) {
      // backfill name if somehow empty
      post.created_by = { ...post.created_by, ...createdBy(req) };
    }

    if (isCommitteeOrAdmin) {
      post.status = status !== undefined ? Number(status) : (existing ? existing.status : 1);
    }

    post.image = imageFromRequest(req, post.image);
    await post.save();

    return apiResponse(res, existing ? 200 : 201, 'Post saved successfully', {
      _id: post._id || String(post._id),
      created_by: post.created_by || {},
      title: post.title || '',
      description: post.description || '',
      image: publicUrl(req, post.image || ''),
      cdate: post.cdate || '',
      status: Number(post.status ?? 0),
      is_own: String(req.user?._id) === String(post.created_by?.id)

    });
  } catch (error) {
    return apiResponse(res, 500, 'Error saving post', { error: error.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const isCommitteeOrAdmin = req.user && (req.user.is_committee || req.user.role === 'admin' || req.user.relation === 'Self');

    const orConditions = [{ id: String(id) }];
    if (mongoose.isValidObjectId(id)) orConditions.push({ _id: id });

    const query = { $or: orConditions };
    if (!isCommitteeOrAdmin) query['created_by.id'] = req.user?._id;

    const result = await Post.deleteOne(query);
    if (result.deletedCount === 0) return apiResponse(res, 404, 'Post not found or unauthorized');

    return apiResponse(res, 200, 'Post deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting post', { error: error.message });
  }
};

module.exports = { getPosts, getPostById, savePost, deletePost };