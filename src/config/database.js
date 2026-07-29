const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is missing in .env');
    }

    if (process.env.DNS_SERVERS) {
      const dnsServers = process.env.DNS_SERVERS.split(',').map((server) => server.trim()).filter(Boolean);
      if (dnsServers.length > 0) {
        dns.setServers(dnsServers);
      }
    }
    
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host} 🍃`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message} ❌`);
    process.exit(1);
  }
};

module.exports = connectDB;
