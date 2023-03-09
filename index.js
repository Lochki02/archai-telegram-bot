require('dotenv').config();
//const { Telegraf } = require('telegraf');
const { Composer } = require('micro-bot')
const fetchPost = (url, method, body) => import('node-fetch').then(({ default: fetch }) => fetch(url, {
    method: method,
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
}));
const fetchGet = (url) => import('node-fetch').then(({ default: fetch }) => fetch(url))
const getAtlasClient = require("./mongodb-config")
const ObjectId = require("mongodb").ObjectId
const { BOT_TOKEN, API_URL } = process.env
//const bot = new Telegraf(BOT_TOKEN);
const bot = new Composer
const dexToolsLink = "https://www.dextools.io/app/en/ether/pair-explorer/0x94ce5a0677e32584a672fa28a6dcb63b53b8196f"
const uniswapLink = "https://app.uniswap.org/#/swap?inputCurrency=0x5c8190b76e90b4dd0702740cf6eb0f7ee01ab5e9&outputCurrency=ETH"

bot.command('start', async (ctx) => {
    ctx.telegram.sendMessage(ctx.chat.id, `
    Hi, *${ctx.update.message.from.username ? ctx.update.message.from.username : "User"}*!
    
    I'm an AI bot, powered by @ArchiveAIERC.
    Join us in archiving the AI mind.
    
    
    archiveai.app
    
    
    Commands:
    /commands - Display Code AI's commands.
    /ask - Ask AI a question.
    /archive - Search content posted to our Archives.
    
Please keep in mind this is a beta, so if you have any problem report to @ArchiveAIERC
    `, {
        parse_mode: "Markdown"
    })
});

bot.command('commands', async (ctx) => {
    ctx.telegram.sendMessage(ctx.chat.id, `
Commands:\n
*/archive* - _Fetch data into the ArcAI database using a question._
*/ask* - _Ask ArcAI a question._
*/remainingTickets* - _Get number of remaining tickets for current campaign_
*/leaderboard* - _Get leaderboard of current campaign_
*/campaign* - _Get info of current campaign_
        `,
        {
            parse_mode: "Markdown"
        }
    );
});

bot.command('ask', async (ctx) => {
    const chatID = ctx.chat.id

    try {
        const tempReply = await ctx.telegram.sendMessage(chatID, "Processing your question...")

        const question = ctx.message.text.substring(5);

        if (question != "") {
            let req = await fetchPost(`${API_URL}/user/chatgpt`, "POST", {
                question: question
            })

            let res = await req.json()
            const answer = res.result
            if (!answer) {
                ctx.telegram.sendMessage(chatID, "Something went wrong")
            }
            else {
                ctx.telegram.deleteMessage(chatID, tempReply.message_id)
                const client = await getAtlasClient()

                const msg = await ctx.telegram.sendMessage(
                    chatID,
                    `${answer}\n\n[ArcAI](https://AiArchive.io) | [Chart](${dexToolsLink}) | [Buy](${uniswapLink})`,
                    {
                        parse_mode: "Markdown",
                        disable_web_page_preview: true,
                        reply_to_message_id: ctx.message.message_id,
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "❗",
                                        callback_data: "reset"
                                    },
                                    {
                                        text: "✅",
                                        callback_data: "push_data"
                                    }
                                ]
                            ]
                        }
                    }
                )

                const result = await client.db("TgCache")
                    .collection("answersCache")
                    .insertOne({
                        question: question,
                        answer: answer,
                        user: ctx.from.id,
                        chat: chatID,
                        msg_id: msg.message_id
                    })

                if (!result.acknowledged) ctx.telegram.sendMessage(chatID, "Something went wrong")
            }
        }
        else ctx.telegram.sendMessage(chatID, "Wrong usage => */ask <replace with your question>*", { parse_mode: "Markdown" })
    }
    catch (err) {
        console.log(err)
        ctx.telegram.sendMessage(chatID, "Something went wrong")
    }
});

bot.command('archive', async (ctx) => {
    const chatID = ctx.chat.id
    const tempReply = await ctx.telegram.sendMessage(chatID, "Processing your question...")

    try {
        const question = ctx.message.text.substring(5);

        let req = await fetchPost(`${API_URL}/user/search`, "POST", {
            question: question
        })

        let res = await req.json()

        let data = res.result

        if (data) {
            if (data.length == 0) ctx.telegram.sendMessage(chatID, "No results were found")
            else {
                for (let i = 0; i < data.length; i++) {
                    ctx.telegram.sendMessage(chatID, data[i].answer)
                }
            }
        }
        else ctx.telegram.sendMessage(chatID, "Something went wrong")

        ctx.telegram.deleteMessage(chatID, tempReply.message_id)
    }
    catch (err) {
        console.log(err)
        ctx.telegram.sendMessage(chatID, "Something went wrong")
    }
});

bot.command("price", async (ctx) => {
    const tempMsg = await ctx.telegram.sendMessage(ctx.chat.id, "Fetching ETH price...")

    let req = await fetchGet(`https://api.etherscan.io/api?module=stats&action=ethprice`)

    let res = await req.json()

    if (res.status && String(res.status) == "1") ctx.telegram.sendMessage(ctx.chat.id, "The current ETH price is " + res.result.ethusd + "$")
    else ctx.telegram.sendMessage(ctx.chat.id, res.message)

    ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
})

bot.command("remainingTickets", async (ctx) => {
    const tempMsg = await ctx.telegram.sendMessage(ctx.chat.id, "Fetching remaining tickets...")

    let req = await fetchGet(`${API_URL}/user/campaigns`)
    let res = await req.json()

    const campaign = res.campaign

    if (campaign) {
        if (campaign.active) {
            let req = await fetchGet(`${API_URL}/user/tickets/${campaign.id}`)
            let res = await req.json()
            const tickets = res.tickets

            if (tickets) {
                const num = campaign.tickets - tickets.length

                ctx.telegram.sendMessage(ctx.chat.id, "There are " + num + " tickets available for campaign " + campaign.name)
                ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
            }
            else {
                ctx.telegram.sendMessage(ctx.chat.id, "Something went wrong")
                ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
            }
        }
        else {
            ctx.telegram.sendMessage(ctx.chat.id, campaign.name + " campaign is not active")
            ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
        }
    }
    else {
        ctx.telegram.sendMessage(ctx.chat.id, "The campaign does not exist")
        ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
    }
})

bot.command("leaderboard", async (ctx) => {
    const tempMsg = await ctx.telegram.sendMessage(ctx.chat.id, "Constructing leaderboard...")

    let req = await fetchGet(`${API_URL}/user/campaigns`)
    let res = await req.json()

    const campaign = res.campaign

    if (campaign) {
        if (campaign.active) {
            let req = await fetchGet(`${API_URL}/user/tickets/${campaign.id}`)
            let res = await req.json()
            const tickets = res.tickets

            if (tickets) {
                if (tickets.length != 0) {
                    let compoundedTickets = []
                    let remainingTickets = tickets

                    for (let i = 0; i < tickets.length; i++) {
                        let ticket = tickets[i]
                        let id = ticket.tg_id ? ticket.tg_id : ticket.user_id

                        let filterUserTickets = remainingTickets.filter((tick) => tick.user_id == id || tick.tg_id == id)
                        let deleteUserTickets = remainingTickets.filter((tick) => tick.user_id != id && tick.tg_id != id)
                        remainingTickets = deleteUserTickets

                        compoundedTickets.push({
                            id: id,
                            username: ticket.tg_id ? ticket.tg_username : ticket.username,
                            tickets: filterUserTickets.length,
                            timestamp: filterUserTickets[filterUserTickets.length - 1].timestamp
                        })

                        if (remainingTickets.length == 0) break
                    }

                    compoundedTickets.sort((a, b) => {
                        if (a.tickets < b.tickets) return -1
                        else if (a.tickets > b.tickets) return 1
                        else {
                            if (a.timestamp >= b.timestamp) return 1
                            else return -1
                        }
                    })

                    ctx.telegram.sendMessage(ctx.chat.id, `*Leaderboard ${campaign.name}* \n\n🥇- *${compoundedTickets[0].username + " (" + compoundedTickets[0].tickets + ")"}* \n🥈- *${compoundedTickets[1] ? compoundedTickets[1].username + " (" + compoundedTickets[1].tickets + ")" : "---"}* \n🥉- *${compoundedTickets[2] ? compoundedTickets[2].username + " (" + compoundedTickets[2].tickets + ")" : "---"}*`, {
                        parse_mode: "Markdown"
                    })
                }
                else {
                    ctx.telegram.sendMessage(ctx.chat.id, "Tickets have not been distributed yet")
                    ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
                }
            }
            else {
                ctx.telegram.sendMessage(ctx.chat.id, "Something went wrong")
                ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
            }
        }
        else {
            ctx.telegram.sendMessage(ctx.chat.id, campaign.name + " campaign is not active")
            ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
        }
    }
    else {
        ctx.telegram.sendMessage(ctx.chat.id, "The campaign does not exist")
        ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
    }
})

bot.command("campaign", async(ctx) =>{
    const tempMsg = await ctx.telegram.sendMessage(ctx.chat.id, "Fetching infos...")

    let req = await fetchGet(`${API_URL}/user/campaigns`)
    let res = await req.json()

    const campaign = res.campaign

    if(campaign){
        ctx.telegram.sendMessage(ctx.chat.id, `Info campaign ${campaign.name}\n\n🎟️*Tickets:* ${campaign.tickets}\n⛔*Active:* ${campaign.active ? "Yes" : "No"}\n🍧*Tickets Limit:* ${campaign.max_tickets}\n🏆*Winner slots:* ${campaign.num_winners}\n💰*Reward:* ${campaign.reward}`, {
            parse_mode: "Markdown"
        })
        ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
    }
    else {
        ctx.telegram.sendMessage(ctx.chat.id, "The campaign does not exist")
        ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
    }
})

bot.action("push_data", async (ctx) => {
    const tempMsg = await ctx.telegram.sendMessage(ctx.chat.id, "Processing your push...")
    const client = await getAtlasClient()

    let cacheMsg = await client.db("TgCache").collection("answersCache").findOne({
        user: ctx.update.callback_query.from.id,
        msg_id: ctx.update.callback_query.message.message_id,
        chat: ctx.update.callback_query.message.chat.id
    })

    if (cacheMsg) {
        try {
            let req = await fetchPost(`${API_URL}/user/request`, "POST", {
                question: cacheMsg.question,
                answer: cacheMsg.answer,
                username: ctx.update.callback_query.from.username
            })
            let res = await req.json()

            if (res.failed) ctx.telegram.sendMessage(ctx.chat.id, res.error)
            else {
                ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
                ctx.telegram.sendMessage(ctx.chat.id, "Push was successful and will be reviewed by admins")

                const result = await client.db("TgCache").collection("answersCache").deleteOne({ _id: new ObjectId(cacheMsg._id) })
                if (!result.acknowledged) console.log("ERRORE DELETE")

                let req = await fetchPost(`${API_URL}/user/ticket/assign`, "POST", {
                    user_id: ctx.from.id,
                    tg_user: ctx.from.username
                })
                let res = await req.json()

                if (!res.failed) ctx.telegram.sendMessage(ctx.from.id, "Congratulation, you've been assigned ticket #" + res.ticket.id + " for campaign " + res.ticket.campaign)
                else ctx.telegram.sendMessage(ctx.from.id, res.error)
            }
        }
        catch (err) {
            console.log("Sending obj is having troubles")
        }
    }
    else ctx.telegram.sendMessage(ctx.chat.id, "This push has expired")
})

bot.action("reset", async (ctx) => {
    const client = await getAtlasClient()

    let cacheMsg = await client.db("TgCache").collection("answersCache").findOne({
        user: ctx.update.callback_query.from.id,
        msg_id: ctx.update.callback_query.message.message_id,
        chat: ctx.update.callback_query.message.chat.id
    })

    if (cacheMsg) {

        try {
            let req = await fetchPost(`${API_URL}/user/reject`, "POST", {
                question: tempObj.question,
                answer: tempObj.answer,
                username: tempObj.username
            })
            let res = await req.json()

            if (res.failed) ctx.telegram.sendMessage(ctx.chat.id, res.error)
            else {
                const result = await client.db("TgCache").collection("answersCache").deleteOne({ _id: new ObjectId(cacheMsg._id) })
                if (!result.acknowledged) console.log("ERRORE DELETE")

                let req = await fetchPost(`${API_URL}/user/ticket/assign`, "POST", {
                    user_id: ctx.from.id,
                    tg_user: ctx.from.username
                })
                let res = await req.json()

                if (!res.failed) ctx.telegram.sendMessage(ctx.from.id, "Congratulation, you've been assigned ticket #" + res.ticket.ticket_id + " for campaign " + res.ticket.campaign)
                else ctx.telegram.sendMessage(ctx.from.id, res.error)
            }
        } catch (err) {
            console.log("Sending obj is having troubles")
        }
    }
    else console.log("Cache is having troubles")
})

//bot.launch()
module.exports = bot