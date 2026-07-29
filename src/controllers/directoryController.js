const User = require('../models/userModels');
const Country = require('../models/countryModel');
const State = require('../models/stateModel');
const City = require('../models/cityModel');
const { apiResponse,  memberPublicId, publicUrl } = require('../utils/apiResponse');
const queryHelper = require('../utils/queryHelper');

const requestData = (req) => ({
  ...req.query,
  ...req.body
});

const asName = (doc, key) => doc?.[key] || doc?.name || '';

const locationMaps = async (req) => {
  const [countries, states, cities] = await Promise.all([
    Country.find().lean(),
    State.find().lean(),
    City.find().lean()
  ]);

  return {
    countries: new Map(countries.map((item) => [String(item.id || item._id), item])),
    states: new Map(states.map((item) => [String(item.id || item._id), item])),
    cities: new Map(cities.map((item) => [String(item.id || item._id), item]))
  };
};

const memberRow = (req, member, maps = {}) => {
  const id = memberPublicId(member);
  const country = maps.countries?.get(String(member.country_id));
  const state = maps.states?.get(String(member.state_id));
  const city = maps.cities?.get(String(member.city_id));

  return {
    id,
    number: member.number || '',
    district_id: member.district_id || '',
    taluka_id: member.taluka_id || '',
    city_id: member.city_id || '',
    village_id: member.village_id || '',
    address: member.address || '',
    district_name: member.district_name || '',
    taluka_name: member.taluka_name || '',
    city_name: member.city_name || asName(city, 'city'),
    village_name: member.village_name || '',
    country_id: member.country_id || '',
    state_id: member.state_id || '',
    country_name: member.country_name || asName(country, 'country'),
    state_name: member.state_name || asName(state, 'state'),
    image: publicUrl(req, member.image || member.profile_image || '')
  };
};

const getMembers = async (req, res) => {
  try {
    const query = {
      relation: 'Self'
    };

    const { data: members, pagination } = await queryHelper(User, req.query, {
      baseQuery: query,
      searchFields: ['first_name', 'middle_name', 'last_name', 'number', 'email',  'address'],
      filterFields: ['country_id', 'state_id', 'city_id', 'district_id', 'taluka_id', 'village_id'],
      select: '-password'
    });
    const maps = await locationMaps(req);

    return apiResponse(res, 200, 'Memebers Data fetch successful', members.map((member) => memberRow(req, member, maps)), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving directory', { error: error.message });
  }
};

const getFamilyMembers = async (req, res) => {
  try {
    const { member_id } = requestData(req);

    if (!member_id) {
      return apiResponse(res, 401, 'Invalid member');
    }

    const parent = await User.findOne({
      $and: [
      
        { member_id: String(member_id) }
      ]
    }).select('-password').lean();

    if (!parent) {
      return apiResponse(res, 401, 'Invalid member');
    }

    const familyHeadId = parent.family_head?.id || parent._id;
    if (!familyHeadId) {
      return apiResponse(res, 401, 'Family head not found');
    }

    const { data: family, pagination } = await queryHelper(User, req.query, {
      baseQuery: {
        'family_head.id': String(familyHeadId),
        _id: { $ne: parent._id }
      },
      searchFields: ['first_name', 'middle_name', 'last_name', 'number', 'email', 'relation'],
      filterFields: ['relation', 'gender', 'blood_group', 'status'],
      select: '-password'
    });
    const maps = await locationMaps(req);

    return apiResponse(res, 200, 'Family Memeber Data fetch successful', family.map((member) => {
      const merged = {
        ...member,
  
        district_id: parent.district_id || '',
        taluka_id: parent.taluka_id || '',
        city_id: parent.city_id || '',
        village_id: parent.village_id || '',
        country_id: parent.country_id || '',
        state_id: parent.state_id || '',
        address: parent.address || ''
      };

      return memberRow(req, merged, maps);
    }), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving family tree', { error: error.message });
  }
};


const getCountryList = async (req, res) => {
  try {
    const { data, pagination } = await queryHelper(Country, req.query, {
      searchFields: ['country', 'name'],
      filterFields: ['country', 'name', 'status']
    });
    return apiResponse(res, 200, 'Country data fetch successfully', data.map((country) => ({
      id: country._id || String(country._id),
      country: country.country || country.name || ''
    })), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving countries', { error: error.message });
  }
};

const getStateList = async (req, res) => {
  try {
    const { country_id } = requestData(req);

    if (!country_id) {
      return apiResponse(res, 401, 'Country id is required');
    }

    const { data, pagination } = await queryHelper(State, req.query, {
      baseQuery: { country_id: String(country_id) },
      searchFields: ['state', 'name'],
      filterFields: ['state', 'name', 'status']
    });
    return apiResponse(res, 200, 'State data fetch successfully', data.map((state) => ({
      id: state._id || String(state._id),
      state: state.state || state.name || ''
    })), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving states', { error: error.message });
  }
};

const getCityList = async (req, res) => {
  try {
    const { state_id } = requestData(req);

    if (!state_id) {
      return apiResponse(res, 401, 'State id is required');
    }

    const { data, pagination } = await queryHelper(City, req.query, {
      baseQuery: { state_id: String(state_id) },
      searchFields: ['city', 'name'],
      filterFields: ['city', 'name', 'status']
    });
    return apiResponse(res, 200, 'City data fetch successfully', data.map((city) => ({
      id: city._id || String(city._id),
      city: city.city || city.name || ''
    })), pagination);
  } catch (error) {
    return apiResponse(res, 500, 'Error retrieving cities', { error: error.message });
  }
};

module.exports = {
  getMembers,
  getFamilyMembers,
  getCountryList,
  getStateList,
  getCityList
};
