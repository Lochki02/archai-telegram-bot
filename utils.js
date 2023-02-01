const nlp = require('compromise/three')
const db = require("./configs/firebase-config")
const openai = require("./configs/openai-config")
const { collection, getDocs, query, where, doc, addDoc } = require("@firebase/firestore")

const sentenceParts = [
    "Noun",
    "Verb",
    "Expression"
]

function filterSentence(sentence) {
    let loweredSentence = sentence.toLowerCase()

    let totalTerms = []
    let splitTerms = nlp(loweredSentence).json({ offset: true })[0]

    for(let i = 0; i < splitTerms.terms.length; i++){
        let term = splitTerms.terms[i]

        if(sentenceParts.includes(term.chunk)) totalTerms.push(term.normal)
        else{
            for(let j = 0; j < sentenceParts.length; j++){
                let part = sentenceParts[j]
                if(term.tags.includes(part)){
                    totalTerms.push(term.normal)
                    break
                }
            }
        }
    }

    return totalTerms
}

async function queryString(coll, question) {
    const queriesRef = collection(db, coll)
    const queryData = query(queriesRef, where("question", "==", question))
    const docs = await getDocs(queryData)

    if (docs.length > 0) {
        let doc = docs[0]

        let data = doc.data()
        let id = doc.id

        let obj = {
            id: id,
            data_id: data['id'],
            answer: data['answer'],
            question: data['question'],
            date: data['date'],
            occurrencies: 1
        }

        return [obj]
    }
    else return null
}

async function queryKeywords(coll, keywords, question) {
    let fetched = []
    const queriesRef = collection(db, coll)
    let loweredSentence = question.toLowerCase()

    for (let i = 0; i < keywords.length; i++) {
        const queryData = query(queriesRef, where("keywords", "array-contains", keywords[i]))
        const docs = await getDocs(queryData)

        //console.log(keywords[i], "=>", docs.size)

        docs.forEach((doc) => {
            //console.log("fetched_size", "=>", fetched.length)
            if (i == 0) {
                let data = doc.data()
                let id = doc.id

                let obj = {
                    id: id,
                    data_id: data['id'],
                    answer: data['answer'],
                    question: data['question'],
                    date: data['date'],
                    occurrencies: 1
                }

                fetched.push(obj)
            }
            else {
                let data = doc.data()
                let id = doc.id

                let exists = fetched.filter((answ) => answ.id == id)[0]
                if (exists) {
                    let replace = fetched.filter((answ) => answ.id != id)
                    exists.occurrencies++
                    replace.push(exists)
                    fetched = replace
                }
                else{
                    let obj = {
                        id: id,
                        data_id: data['id'],
                        answer: data['answer'],
                        question: data['question'],
                        date: data['date'],
                        occurrencies: 1
                    }

                    fetched.push(obj)
                }
            }
        })
    }

    //console.log("fetched", "=>", fetched)

    let totalOccurrencies = 0
    for(let i = 0; i < fetched.length; i++){
        totalOccurrencies += fetched[i].occurrencies
    }

    let avg = Math.round(totalOccurrencies / fetched.length)

    let maxOccurrencies = []
    for(let i = 0; i < fetched.length; i++){
        if(fetched[i].occurrencies >= avg) maxOccurrencies.push(fetched[i])
    }

    return maxOccurrencies.length > 0 ? maxOccurrencies : null;
}

async function askChatGPT(question, module){
    try{
        const res = await openai.createCompletion({
            model: module,
            prompt: question,
            max_tokens: 257,
            temperature: 0
        })

        return res.data.choices[0].text
    }
    catch(err) { return null }
    //console.log("ping")
}

function structureDoc(coll){
    return collection(db, coll)
}

async function sendToDb(ref, obj){
    let res = await addDoc(ref, obj)

    return res
}

module.exports = { filterSentence, queryKeywords, queryString, askChatGPT, structureDoc, sendToDb }