const { Configuration, OpenAIApi } = require("openai")
require('dotenv').config()

const configuration = new Configuration({
    organization: "org-MyOozMzI3OQ3HJI0bpCcPSPP",
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration)

module.exports = openai