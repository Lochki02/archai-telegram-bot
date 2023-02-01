require('dotenv').config();
//const { Telegraf } = require('telegraf');
const { Composer } = require('micro-bot')
const { TELEGRAM_BOT_TOKEN } = process.env
//const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const bot = new Composer

const { filterSentence, queryKeywords, queryString, askChatGPT, structureDoc, sendToDb } = require("./utils")

class TemporaryObject{
    question = ""
    answer = ""
    username = ""
    chat = 0

    constructor(question, answer, username, chat){
        this.question = question
        this.answer = answer
        this.username = username
        this.chat = chat
    }
}

let tempArray = []

bot.command('start', async (ctx) => {
    ctx.telegram.sendMessage(ctx.chat.id, `
    Hi, ${ctx.update.message.from.id}!

    I'm an AI bot, powered by @AiArchiveERC.
    Join in on archiving the AI mind.


    aioverflow.app X CodeAI.


    Commands:
    /commands - Display Code AI's commands.
    /ask - Ask Code AI a programming related question.
    /archive - Search content into Archive AI.

    Please keep in mind this is a beta, so if you have any problem report to @AiArchiveERC
    `)
});

bot.command('commands', async (ctx) => {
    ctx.deleteMessage(ctx.update.message.message_id);

    ctx.telegram.sendMessage(ctx.chat.id, `
        Commands:
            /archive - Fetch data into the ArchAI database using a question.
            /ask - Ask ArchAI a question.
        `
    );
});

bot.command('ask', async (ctx) => {
    const chatID = ctx.chat.id
    console.log(chatID)

    try{
        const tempReply = await ctx.telegram.sendMessage(chatID, "Processing your question...")

        const question = ctx.message.text.substring(5);

        let answer = await askChatGPT(question, "text-davinci-003")

        if(!answer){
            ctx.telegram.sendMessage(chatID, "Something went wrong")
        }
        else{
            ctx.telegram.deleteMessage(chatID, tempReply.message_id)
            let tempObj = new TemporaryObject(question, answer, ctx.from.username, chatID)

            tempArray = tempArray.filter((obj) => obj.chat != chatID)
            tempArray.push(tempObj)

            ctx.telegram.sendMessage(chatID, answer)
            ctx.telegram.sendMessage(chatID,`
            If you are happy with the answer recieved from ArchAIBot please consider helping us by requesting a push to add this data to the database
                `,
                {
                    reply_markup:{
                        inline_keyboard:[
                            [
                                {
                                    text: "Push",
                                    callback_data: "push_data"
                                },
                                {
                                    text: "Don't",
                                    callback_data: "reset"
                                }
                            ]
                        ]
                    }
                }
            )
        }
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
    let filteredAnswers = tempArray.filter((obj) => obj.chat == ctx.chat.id)
    let tempObj = filteredAnswers[filteredAnswers.length - 1];
    
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
    tempArray = tempArray.filter((obj) => obj.chat != obj.chat)
})

//bot.launch()
module.exports = bot