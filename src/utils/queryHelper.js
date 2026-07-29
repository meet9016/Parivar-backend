const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const castValue = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const mergeQuery = (baseQuery = {}, extraQuery = {}) => {
  if (!baseQuery || Object.keys(baseQuery).length === 0) return extraQuery;
  if (!extraQuery || Object.keys(extraQuery).length === 0) return baseQuery;
  return { $and: [baseQuery, extraQuery] };
};

const queryHelper = async (Model, query = {}, options = {}) => {
  const {
    baseQuery = {},
    filterFields = [],
    searchFields = [],
    defaultLimit = 10,
    defaultSort = { _id: -1 },
    select,
    populate,
    lean = true
  } = options;

  const extraQuery = {};

  if (query.search && searchFields.length) {
    const regex = new RegExp(escapeRegExp(query.search), 'i');
    extraQuery.$or = searchFields.map((field) => ({ [field]: regex }));
  }

  filterFields.forEach((field) => {
    if (hasValue(query[field])) {
      extraQuery[field] = castValue(query[field]);
    }
  });

  const requestedPage = Math.max(parseInt(query.page, 10) || 1, 1);
  const requestedLimit = parseInt(query.limit, 10);
  const limit = Math.max(Number.isFinite(requestedLimit) ? requestedLimit : defaultLimit, 1);
  const sortField = query.sort_by || Object.keys(defaultSort)[0] || '_id';
  const sortDirection = String(query.sort_order || '').toLowerCase() === 'asc' ? 1 : -1;
  const sort = query.sort_by ? { [sortField]: sortDirection } : defaultSort;
  const finalQuery = mergeQuery(baseQuery, extraQuery);
  const total = await Model.countDocuments(finalQuery);
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(requestedPage, totalPages);

  let dbQuery = Model.find(finalQuery).sort(sort);
  if (select) dbQuery = dbQuery.select(select);
  if (populate) dbQuery = dbQuery.populate(populate);
  dbQuery = dbQuery.skip((page - 1) * limit).limit(limit);
  if (lean) dbQuery = dbQuery.lean();

  const data = await dbQuery;

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages
    }
  };
};

module.exports = queryHelper;
