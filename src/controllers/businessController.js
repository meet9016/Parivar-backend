const Business = require('../models/businessModel');
const BusinessCategory = require('../models/businessCategoryModel');
const User = require('../models/userModels');
const Country = require('../models/countryModel');
const State = require('../models/stateModel');
const City = require('../models/cityModel');
const { getRolePermissions } = require('../middleware/auth');
const { apiResponse, memberPublicId, publicUrl, fullName } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');
const mongoose = require('mongoose');

const createdBy = (req) => {
  const user = req.user || {};
  return {
    id: user._id || user.id || '',
    name: fullName(user) || user.name || user.username || user.email || ''
  };
};

const requestData = (req) => ({
  ...req.query,
  ...req.body
});


const findBusinessByRequestId = (req, id) => {
  return Business.findOne({
    $or: [
      { id: String(id) },
      { _id: id.match(/^[a-f\d]{24}$/i) ? id : null }
    ]
  });
};

const checkIsOwn = (item, user) => {
  if (!user) return false;
  const userIds = new Set([
    String(user._id || ''),
    String(user.id || ''),
    String(user.member_id || '')
  ].filter(Boolean));

  const itemIds = [
    String(item.created_by?.id || ''),
    String(item.member_id || '')
  ].filter(Boolean);

  return itemIds.some(id => userIds.has(id));
};

const formatBusiness = (req, b, categoryName = 'Community Enterprise', extra = {}) => ({
  id: String(b._id),
  member_id: b.member_id || '',
  owner_name: extra.owner_name || '',
  owner_phone: extra.owner_phone || '',
  owner_email: extra.owner_email || '',
  owner_image: extra.owner_image || '',
  business_name: b.business_name || '',
  business_category_id: b.business_category_id || '',
  business_category_name: categoryName,
  number: b.number || '',
  whatsapp_number: b.whatsapp_number || '',
  GST_number: b.GST_number || '',
  email: b.email || '',
  country_id: b.country_id || '',
  country_name: extra.country_name || '',
  state_id: b.state_id || '',
  state_name: extra.state_name || '',
  city_id: b.city_id || '',
  city_name: extra.city_name || '',
  address: b.address || '',
  location_link: b.location_link || '',
  about_us: b.about_us || '',
  facebook: b.facebook || '',
  instagram: b.instagram || '',
  pinterest: b.pinterest || '',
  youtube: b.youtube || '',
  website: b.website || '',
  image: publicUrl(req, b.image || b.image || ''),
  gallery_images: (b.gallery_images || []).map(img => publicUrl(req, img)),
  is_own: checkIsOwn(b, req.user),
  status: b.status !== undefined ? Number(b.status) : 1,
  createdAt: b.createdAt || '',
  updatedAt: b.updatedAt || ''
});

const getBusinesses = async (req, res) => {
  try {
    let baseQuery = {};
    const { is_own } = req.query;
    const user = req.user;
    const permissions = getRolePermissions(user);
    const isAdmin = user?.committee_role === 'President' || permissions?.includes('businesses.edit') || !!user?.role_id;

    if (user) {
      const userIds = [
        String(user._id || ''),
        String(user.id || ''),
        String(user.member_id || '')
      ].filter(Boolean);
      const objectIds = userIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));

      if (is_own === 'true') {
        baseQuery.$or = [
          { member_id: { $in: userIds } }
        ];
        if (objectIds.length > 0) {
          baseQuery.$or.push({ 'created_by.id': { $in: objectIds } });
        }
        delete req.query.status;
      } else if (!isAdmin && (req.query.status === undefined || req.query.status === null || req.query.status === '')) {
        baseQuery.$or = [
          { status: 1 },
          { status: '1' },
          { status: { $exists: false } },
          { status: null },
          { member_id: { $in: userIds } }
        ];
        if (objectIds.length > 0) {
          baseQuery.$or.push({ 'created_by.id': { $in: objectIds } });
        }
      }
    }
    const [{ data: businesses, pagination }, categories, countries, states, cities] = await Promise.all([
      queryHelper(Business, req.query, {
        baseQuery,
        searchFields: ['business_name', 'number', 'whatsapp_number', 'GST_number', 'email', 'address', 'about_us', 'website'],
        filterFields: ['member_id', 'business_category_id', 'country_id', 'state_id', 'city_id', 'status']
      }),
      BusinessCategory.find({}).lean(),
      Country.find({}).lean(),
      State.find({}).lean(),
      City.find({}).lean()
    ]);

    const memberIds = [...new Set(businesses.map(b => b.member_id).filter(Boolean))];
    const owners = memberIds.length > 0 ? await User.find({
      $or: [
        { id: { $in: memberIds } },
        { _id: { $in: memberIds.filter(id => mongoose.isValidObjectId(id)) } }
      ]
    }).lean() : [];

    const ownerMap = new Map();
    owners.forEach(u => {
      const data = {
        name: [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ') || u.name || '',
        phone: u.number || u.phone || '',
        email: u.email || '',
        image: publicUrl(req, u.image || '')
      };
      if (u._id) ownerMap.set(String(u._id), data);
      if (u.id) ownerMap.set(String(u.id), data);
    });

    const categoryMap = new Map();
    categories.forEach(c => {
      if (c._id) categoryMap.set(String(c._id), c.business || c.name || '');
      if (c.id) categoryMap.set(String(c.id), c.business || c.name || '');
    });

    const countryMap = new Map();
    countries.forEach(c => {
      if (c._id) countryMap.set(String(c._id), c.name || c.title || '');
      if (c.id) countryMap.set(String(c.id), c.name || c.title || '');
    });

    const stateMap = new Map();
    states.forEach(s => {
      if (s._id) stateMap.set(String(s._id), s.name || s.title || '');
      if (s.id) stateMap.set(String(s.id), s.name || s.title || '');
    });

    const cityMap = new Map();
    cities.forEach(c => {
      if (c._id) cityMap.set(String(c._id), c.name || c.title || '');
      if (c.id) cityMap.set(String(c.id), c.name || c.title || '');
    });

    return apiResponse(res, 200, 'Businesses retrieved successfully', businesses.map(b => {
      const categoryName = categoryMap.get(String(b.business_category_id)) || 'Community Enterprise';
      const owner = ownerMap.get(String(b.member_id)) || {};
      const extra = {
        owner_name: owner.name || '',
        owner_phone: owner.phone || '',
        owner_email: owner.email || '',
        owner_image: owner.image || '',
        country_name: countryMap.get(String(b.country_id)) || '',
        state_name: stateMap.get(String(b.state_id)) || '',
        city_name: cityMap.get(String(b.city_id)) || ''
      };
      return formatBusiness(req, b, categoryName, extra);
    }), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving businesses', { error: error.message });
  }
};


const getBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    const business = await findBusinessByRequestId(req, id);
    if (!business) {
      return apiResponse(res, 404, 'Business not found');
    }

    const [category, country, state, city, owner] = await Promise.all([
      BusinessCategory.findOne({
        $or: [
          { id: String(business.business_category_id) },
          ...(mongoose.isValidObjectId(business.business_category_id) ? [{ _id: business.business_category_id }] : [])
        ]
      }).lean(),
      Country.findOne({
        $or: [
          { id: String(business.country_id) },
          ...(mongoose.isValidObjectId(business.country_id) ? [{ _id: business.country_id }] : [])
        ]
      }).lean(),
      State.findOne({
        $or: [
          { id: String(business.state_id) },
          ...(mongoose.isValidObjectId(business.state_id) ? [{ _id: business.state_id }] : [])
        ]
      }).lean(),
      City.findOne({
        $or: [
          { id: String(business.city_id) },
          ...(mongoose.isValidObjectId(business.city_id) ? [{ _id: business.city_id }] : [])
        ]
      }).lean(),
      User.findOne({
        $or: [
          { id: String(business.member_id) },
          ...(mongoose.isValidObjectId(business.member_id) ? [{ _id: business.member_id }] : [])
        ]
      }).lean()
    ]);

    const categoryName = category ? (category.business || category.name || '') : 'Community Enterprise';
    const extra = {
      owner_name: owner ? ([owner.first_name, owner.middle_name, owner.last_name].filter(Boolean).join(' ') || owner.name || '') : '',
      owner_phone: owner ? (owner.number || owner.phone || '') : '',
      owner_email: owner ? (owner.email || '') : '',
      owner_image: owner ? publicUrl(req, owner.image || '') : '',
      country_name: country ? (country.name || country.title || '') : '',
      state_name: state ? (state.name || state.title || '') : '',
      city_name: city ? (city.name || city.title || '') : ''
    };

    return apiResponse(res, 200, 'Business retrieved successfully', formatBusiness(req, business, categoryName, extra));
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving business', { error: error.message });
  }
};


const getBusinessCategoryList = async (req, res) => {
  try {
    const query = req.user ? {} : {};
    const { data: categories, pagination } = await queryHelper(BusinessCategory, req.query, {
      baseQuery: query,
      searchFields: ['business', 'name'],
      filterFields: ['business', 'name']
    });
    const data = categories.map((category) => ({
      id: String(category._id),
      business: category.business || category.name || ''
    }));

    return apiResponse(res, 200, 'Business category data fetch successfully', data, pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving business categories', { error: error.message });
  }
};

const imageFromRequest = (req, fallback = '') => {
  // fields() puts files in req.files, not req.file
  const file = req.files?.['image']?.[0] || req.files?.['image']?.[0];
  if (file) return file.filename;
  if (req.body?.image) return req.body.image;
  return fallback || '';
};

const toStoredPath = (url = '') => {
  return String(url);
};

const galleryPath = (req, key) => {
  const file = req.files?.[key]?.[0];
  if (file) return file.filename;
  if (req.body?.[key]) return req.body[key];
  return '';
};

const addBusinessDetails = async (req, res) => {
  try {
    const { id } = req.params || req.body;
    const { business_category_id, business_name, number, whatsapp_number, GST_number, email, country_id, state_id, city_id, address, location_link, about_us, facebook, instagram, pinterest, youtube, website, status } = requestData(req);

    if (!business_category_id || !business_name || !number || !email || !country_id || !state_id || !city_id) {
      return apiResponse(res, 400, 'All required fields must be provided');
    }

    const currentMemberId = memberPublicId(req.user || {});
    const permissions = getRolePermissions(req.user);
    const isAdmin = req.user?.committee_role === 'President' || permissions.includes('businesses.edit') || !!req.user?.role_id;

    let business = null;

    if (id) {
      business = await findBusinessByRequestId(req, id);
      if (!business) {
        return apiResponse(res, 404, 'Business not found');
      }
      if (!isAdmin && business.member_id !== currentMemberId) {
        return apiResponse(res, 403, 'Unauthorized - You can only edit your own business');
      }
    }

    const businessData = {
      business_category_id,
      business_name,
      number,
      whatsapp_number: whatsapp_number || '',
      GST_number: GST_number || '',
      email,
      country_id,
      state_id,
      city_id,
      address: address || '',
      location_link: location_link || '',
      about_us: about_us || '',
      facebook: facebook || '',
      instagram: instagram || '',
      pinterest: pinterest || '',
      youtube: youtube || '',
      website: website || '',
    };

    // ── Profile image (same pattern as events) ──────────────────────────────
    // 1. New file uploaded → use that
    // 2. existing_image sent from frontend (full URL) → strip to relative path
    // 3. Updating and nothing sent → keep existing value from DB
    const newProfilePath = imageFromRequest(req);
    if (newProfilePath) {
      businessData.image = newProfilePath;
    } else if (req.body.existing_image !== undefined) {
      businessData.image = toStoredPath(req.body.existing_image);
    } else if (business) {
      businessData.image = business.image || '';
    } else {
      businessData.image = '';
    }

    // ── Gallery images ──────────────────────────────────────────────────────
    let finalGalleryImages = [];

    // 1. Existing URLs kept by the frontend (sent as existing_images)
    if (req.body.existing_images !== undefined) {
      const kept = (Array.isArray(req.body.existing_images)
        ? req.body.existing_images
        : [req.body.existing_images]).filter(Boolean);
      finalGalleryImages = kept.map(toStoredPath);
    } else if (business) {
      // Update but no existing_images field sent → keep all existing
      finalGalleryImages = (business.gallery_images || []).map(toStoredPath);
    }

    // 2. Append any newly uploaded gallery images (gallery_image_1 … gallery_image_5)
    for (let i = 1; i <= 5; i++) {
      const path = galleryPath(req, `gallery_image_${i}`);
      if (path) finalGalleryImages.push(path);
    }

    businessData.gallery_images = finalGalleryImages;

    if (business) {
      // Update
      business.set(businessData);
      if (status !== undefined) business.status = Number(status);
      await business.save();

      const category = await BusinessCategory.findOne({
        $or: [
          { id: String(business.business_category_id) },
          ...(require('mongoose').isValidObjectId(business.business_category_id) ? [{ _id: business.business_category_id }] : [])
        ]
      }).lean();

      const categoryName = category ? (category.business || category.name || '') : 'Community Enterprise';
      return apiResponse(res, 200, 'Business updated successfully', formatBusiness(req, business, categoryName));
    }

    // Create
    businessData.id = `BUS${Date.now()}`;
    businessData.member_id = currentMemberId;
    businessData.status = Number(status ?? 0);
    businessData.cdate = new Date().toISOString().slice(0, 10);
    businessData.created_by = createdBy(req);

    const doc = await Business.create(businessData);

    const category = await BusinessCategory.findOne({
      $or: [
        { id: String(doc.business_category_id) },
        ...(require('mongoose').isValidObjectId(doc.business_category_id) ? [{ _id: doc.business_category_id }] : [])
      ]
    }).lean();

    const categoryName = category ? (category.business || category.name || '') : 'Community Enterprise';
    return apiResponse(res, 201, 'Business created successfully', formatBusiness(req, doc, categoryName));
  } catch (error) {
    return apiResponse(res, 500, 'Error saving business', { error: error.message });
  }
};


const deleteBusiness = async (req, res) => {
  try {
    const { id } = req.params;
    const business = await findBusinessByRequestId(req, id);

    if (!business) {
      return apiResponse(res, 404, 'Business not found');
    }

    await Business.deleteOne({ _id: business._id });
    return apiResponse(res, 200, 'Business deleted successfully');
  } catch (error) {
    return apiResponse(res, 500, 'Error deleting business', { error: error.message });
  }
};


module.exports = {
  addBusinessDetails,
  getBusinesses,
  getBusinessById,
  getBusinessCategoryList,
  deleteBusiness,
};
