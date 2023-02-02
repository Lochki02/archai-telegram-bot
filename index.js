require('dotenv').config();
//const { Telegraf } = require('telegraf');
const { Composer } = require('micro-bot')
const { BOT_TOKEN } = process.env
//const bot = new Telegraf(BOT_TOKEN);
const bot = new Composer
const dexToolsLink = "https://www.dextools.io/app/en/ether/pair-explorer/0x94ce5a0677e32584a672fa28a6dcb63b53b8196f"
const uniswapLink = "https://app.uniswap.org/#/swap?inputCurrency=0x5c8190b76e90b4dd0702740cf6eb0f7ee01ab5e9&outputCurrency=ETH"

const { filterSentence, queryKeywords, queryString, askChatGPT, structureDoc, sendToDb } = require("./utils")

class TemporaryObject{
    question = ""
    answer = ""
    username = ""
    user = 0

    constructor(question, answer, username, user){
        this.question = question
        this.answer = answer
        this.username = username
        this.user = user
    }
}

let tempArray = []

bot.command('start', async (ctx) => {
    ctx.telegram.sendMessage(ctx.chat.id, `
    Hi, *${ctx.update.message.from.username ? ctx.update.message.from.username : "User"}*!
    
    I'm an AI bot, powered by @AiArchiveERC.
    Join in on archiving the AI mind.
    
    
    aioverflow.app X CodeAI.
    
    
    Commands:
    /commands - Display Code AI's commands.
    /ask - Ask Code AI a programming related question.
    /archive - Search content into Archive AI.
    
Please keep in mind this is a beta, so if you have any problem report to @AiArchiveERC
    `,{
        parse_mode: "Markdown"
    })
});

bot.command('commands', async (ctx) => {
    ctx.telegram.sendMessage(ctx.chat.id, `
Commands:\n
*/archive* - _Fetch data into the ArchAI database using a question._
*/ask* - _Ask ArchAI a question._
        `,
        {
            parse_mode: "Markdown"
        }
    );
});

bot.command('ask', async (ctx) => {
    const chatID = ctx.chat.id

    try{
        const tempReply = await ctx.telegram.sendMessage(chatID, "Processing your question...")

        const question = ctx.message.text.substring(5);

        if(question != "") {
            let answer = await askChatGPT(question, "text-davinci-003")

            if(!answer){
                ctx.telegram.sendMessage(chatID, "Something went wrong")
            }
            else{
                ctx.telegram.deleteMessage(chatID, tempReply.message_id)
                let tempObj = new TemporaryObject(question, answer, ctx.from.username, ctx.from.id)

                tempArray = tempArray.filter((obj) => obj.user != ctx.from.id)
                tempArray.push(tempObj)

                ctx.telegram.sendMessage(
                    chatID, 
                    `${answer}\n\n[ArchAI](https://AiArchive.io) | [Chart](${dexToolsLink}) | [Buy](${uniswapLink})`,
                    { 
                        parse_mode: "Markdown", 
                        disable_web_page_preview: true,
                        reply_to_message_id: ctx.message.message_id,
                        reply_markup:{
                            inline_keyboard:[
                                [
                                    {
                                        text: "✅ Push",
                                        callback_data: "push_data"
                                    },
                                    {
                                        text: "❗ Don't",
                                        callback_data: "reset"
                                    }
                                ]
                            ]
                        }
                    }
                )
            }
        }
        else ctx.telegram.sendMessage(chatID, "Wrong usage => */ask <replace with your question>*", { parse_mode: "Markdown" })
    }
    catch(err){
        console.log(err)
        ctx.telegram.sendMessage(chatID, "Something went wrong")
    }
});

bot.command('archive', async (ctx) => {
    const chatID = ctx.chat.id
    const tempReply = await ctx.telegram.sendMessage(chatID, "Processing your question...")
    
    try{
        const question = ctx.message.text.substring(5);

        let answer = await queryString("queries", question)
        if(!answer){
            let keywords = filterSentence(question)
            //console.log(keywords)
            answer = await queryKeywords("queries", keywords, question)
        }
        
        for (let i = 0; i < answer.length; i++) {
            ctx.telegram.sendMessage(chatID, answer[i].answer)
        }

        ctx.telegram.deleteMessage(chatID, tempReply.message_id)
        if(answer.length == 0) ctx.telegram.sendMessage(chatID, "No results were found")
    }
    catch(err){
        console.log(err)
        ctx.telegram.sendMessage(chatID, "Something went wrong")
    }
});

bot.action("push_data", async(ctx) =>{
    const tempMsg = await ctx.telegram.sendMessage(ctx.chat.id, "Processing your push...")
    let filteredAnswers = tempArray.filter((obj) => obj.user == ctx.from.id)
    let tempObj = filteredAnswers[filteredAnswers.length - 1];
    tempArray = tempArray.filter((obj) => obj.user != ctx.from.id)
    
    if(tempObj){
        let doc = structureDoc("pushRequests")
        sendToDb(doc, {
            answer: tempObj.answer,
            question: tempObj.question,
            username: tempObj.username ? tempObj.username : "Anonymous",
            state: 0,
            date: Date.now()
        })

        ctx.telegram.sendMessage(ctx.chat.id, "Push was successful and will be reviewed by admins")
    }
    else ctx.telegram.sendMessage(ctx.chat.id, "This push has expired")

    ctx.telegram.deleteMessage(ctx.chat.id, tempMsg.message_id)
})

bot.action("reset", (ctx) =>{
    let filteredAnswers = tempArray.filter((obj) => obj.user == ctx.from.id)
    let tempObj = filteredAnswers[filteredAnswers.length - 1];
    tempArray = tempArray.filter((obj) => obj.user != ctx.from.id)

    if(tempObj){
        try{
            let doc = structureDoc("pushRequests")
            sendToDb(doc, {
                answer: tempObj.answer,
                question: tempObj.question,
                username: tempObj.username ? tempObj.username : "Anonymous",
                state: -1,
                date: Date.now()
            })
        } catch(err){
            console.log("Sending obj is having troubles")
        }
    }
    else console.log("Temp obj is having troubles")
})

//bot.launch()
module.exports = bot