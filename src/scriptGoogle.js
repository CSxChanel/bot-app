function doPost(e) {
    var data = JSON.parse(e.postData.contents);
    var number = data.from;
    var message = data.message.toLowerCase();
    if (message.includes("chatgpt")) {
        var results = getChatGPTResponse(message);
        sendWaText(number, results);
    } else if (message.includes("gemini")) {
        var results = getGeminiResponse(message);
        sendWaText(number, results);
    } else {
        null;
    }
    return true;
}

var idDevice = "xxx";

function sendWaText(number, message) {
    var formdata = {
        device_id: "" + idDevice,
        number: "" + number,
        message: "" + message
    };

    var requestOptions = {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify(formdata),
        redirect: "follow"
    };

    var response = UrlFetchApp.fetch(
        "https://app.whacenter.com/api/send",
        requestOptions
    );
    Logger.log(response);
}

function getGeminiResponse(prompt) {
    if (!prompt) {
        return "No prompt provided.";
    }

    const apiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=xxx"; // Ganti dengan API Key Gemini kamu

    const payload = { contents: [{ parts: [{ text: prompt }] }] };

    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(apiUrl, options);
        const json = JSON.parse(response.getContentText());

        if (json.error) {
            Logger.log("Error: " + json.error.message);
            return "Error from Google Gemini: " + json.error.message;
        }

        const chatResponse = json.candidates[0].content.parts[0].text;
        return chatResponse;
    } catch (error) {
        Logger.log("Error: " + error.message);
        return "There was an error";
    }
}

const OPENAI_API_KEY = "xxx"; // Ganti dengan API Key OPEN AI kamu

function getChatGPTResponse(prompt) {
    if (!prompt) {
        return "No prompt provided.";
    }

    const apiUrl = "https://api.openai.com/v1/chat/completions";

    const payload = {
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: prompt }
        ],
        max_tokens: 150
    };

    const options = {
        method: "post",
        contentType: "application/json",
        headers: {
            Authorization: "Bearer " + OPENAI_API_KEY
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(apiUrl, options);
        const json = JSON.parse(response.getContentText());

        if (json.error) {
            Logger.log("Error: " + json.error.message);
            return "Error from OpenAI: " + json.error.message;
        }

        const chatResponse = json.choices[0].message.content.trim();
        return chatResponse;
    } catch (error) {
        Logger.log("Error: " + error.message);
        return "There was an error contacting the OpenAI API.";
    }
}
