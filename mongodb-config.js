const MongodbClient = require("mongodb").MongoClient
require("dotenv").config()
const { MONGODB_URL } = process.env

const options = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
}

async function getAtlasClient(){
    let client = new MongodbClient(MONGODB_URL, options)

    return await client.connect()
}

module.exports = getAtlasClient