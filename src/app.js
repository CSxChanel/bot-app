import pkg from "@whiskeysockets/baileys";
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    downloadMediaMessage
} = pkg;
import { Boom } from "@hapi/boom";
import fs from "fs";
import os from "os";
import pino from "pino";
import fetch from "node-fetch";
import chalk from "chalk";
import figlet from "figlet";
import dotenv from "dotenv";
import { getGempaData } from "./gempa.js";
import { getHelp, getInfo } from "./setting.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();

const totalMemory = os.totalmem() / 1024 ** 3;
const freeMemory = os.freemem() / 1024 ** 3;

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        }
    };
}

const color = (text, color) => {
    return !color
        ? chalk.green(text)
        : chalk.hex(getHexFromColorName(color))(text);
};
const getHexFromColorName = colorName => {
    const colors = {
        turquoise: "#40E0D0",
        kuning: "#feff03ff",
        merah: "#ff1616"

        // tambah lbih warna
    };
    return colors[colorName.toLowerCase()] || "#ffffff";
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
    console.log(
        color(
            figlet.textSync("Wa-Bot-AI", {
                font: "Standard",
                horizontalLayout: "default",
                verticalLayout: "default",
                whitespaceBreak: false
            }),
            "kuning"
        )
    );

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,

        auth: state
    });

    sock.ev.on("connection.update", update => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect.error instanceof Boom &&
                lastDisconnect.error.output.statusCode !==
                    DisconnectReason.loggedOut;
            console.log(
                color("connection closed due to "),
                lastDisconnect.error,
                ", reconnecting ",
                shouldReconnect
            );
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === "open") {
            console.log(color("Connetion Open"));
        }
    });
    sock.ev.on("creds.update", saveCreds);

    // Log Info Gempa Uptodate
    const infoGempaUrl = process.env.BMKG_GEMPA;
    const responsInfo = await fetch(infoGempaUrl + "autogempa.json");
    const infoData = await responsInfo.json();
    const infoDataGempa = infoData.Infogempa.gempa;
    console.log(infoDataGempa);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const messageContent =
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            (m.message.imageMessage &&
                `[Gambar] ${
                    m.message.imageMessage.caption || "(tidak ada caption)"
                }`) || // Pesan gambar
            (m.message.videoMessage &&
                `[Video] ${
                    m.message.videoMessage.caption || "(tidak ada caption)"
                }`) || // Pesan video
            (m.message.stickerMessage && "[Stiker]") || // Pesan stiker
            "";

        // Fungsi untuk mendapatkan nama pengirim
        const name = () => {
            return m.pushName || m.key.remoteJid.split("@")[0];
        };
        // Fungsi untuk nomor telepon pengirim
        const nomor = () => {
            return m.key.remoteJid.split("@")[0];
        };
        const prefix = "#";
        // Fungsi untuk mengirim Reply
        const reply = msg =>
            sock.sendMessage(m.key.remoteJid, { text: msg }, { quoted: m });
        // Cek dari Group, Status
        const isFromGroup = m.key.remoteJid.endsWith("@g.us");
        const isDirectMessage = !isFromGroup;
        const isFromStatus = m.key.remoteJid.includes("status@broadcast");
        const isFromMe = m.key.fromMe;

        // Menangani pesan gambar
        if (
            !isFromMe &&
            m.message.imageMessage &&
            (isDirectMessage || isFromGroup) &&
            !isFromStatus
        ) {
            const responseMessage = await reply(
                `Halo *${name()}* 👋, gambar sedang di proses...`
            );

            try {
                console.log(color("Got an image to process"));

                const reactionMessage = {
                    react: {
                        text: "⏳",
                        key: responseMessage.key
                    }
                };

                await sock.sendMessage(
                    responseMessage.key.remoteJid,
                    reactionMessage
                );

                await new Promise(resolve => setTimeout(resolve, 1000));

                // Download the image
                const mediaMessage = await downloadMediaMessage(m, "buffer");
                const filePath = "../temp/image.jpg";
                fs.writeFileSync(filePath, mediaMessage);

                const imagePart = fileToGenerativePart(filePath, "image/jpeg");

                const prompt =
                    "apa tanggapan kamu dari gambar ini dan jelaskan.";
                const result = await model.generateContent([prompt, imagePart]);
                const generatedText = result.response.text();

                const removeReaction = {
                    react: {
                        text: "",
                        key: responseMessage.key
                    }
                };

                await sock.sendMessage(
                    responseMessage.key.remoteJid,
                    removeReaction
                );

                await reply(generatedText + "\n\nketik *#help*");

                // Clean up the temporary file
                fs.unlinkSync(filePath);
            } catch (error) {
                console.error("Error from Google Gemini API:", error);

                await reactionMessage(responseMessage.key, "");

                const errorMessage = `Maaf, sepertinya ada yang error saat memproses gambar.\nError: ${error.message}`;
                await reply(errorMessage);
            }
        } else if (
            messageContent.startsWith(prefix) &&
            messageContent.endsWith("?")
        ) {
            // Handle question messages
            try {
                const cleanedMessage = messageContent.slice(prefix.length);
                // membuat fitur Reaksi
                const reactionMessage = {
                    react: {
                        text: "⏳",
                        key: m.key
                    }
                };
                // Tambahkan Reaksi kedalam pesan
                await sock.sendMessage(m.key.remoteJid, reactionMessage);

                await new Promise(resolve => setTimeout(resolve, 2000));

                const result = await model.generateContent(cleanedMessage);
                let generatedText = result.response.text();

                const removeReaction = {
                    react: {
                        text: "",
                        key: m.key
                    }
                };
                // Kirim pesan reaksi
                await sock.sendMessage(m.key.remoteJid, removeReaction);

                await reply(generatedText + "\n\nketik *#help*");
            } catch (error) {
                console.error("Error from Google Gemini API:", error);
                const errorMessage = `Maaf, sepertinya ada yang error saat memproses pertanyaan.\nError: ${error.message}`;
                await reply(errorMessage);
            }
        } else if (messageContent.toLowerCase() === "#quote") {
            // Handle #quote messages
            try {
                const quotePrompt = "Berikan saya kutipan yang menginspirasi";
                console.log("#quote :", quotePrompt);
                // membuat fitur Reaksi
                const reactionMessage = {
                    react: {
                        text: "⏳",
                        key: m.key
                    }
                };

                await sock.sendMessage(m.key.remoteJid, reactionMessage);

                await new Promise(resolve => setTimeout(resolve, 2000));

                const result = await model.generateContent(quotePrompt);
                let generatedQuote = result.response.text();

                const removeReaction = {
                    react: {
                        text: "",
                        key: m.key
                    }
                };

                await sock.sendMessage(m.key.remoteJid, removeReaction);

                await reply(generatedQuote);
            } catch (error) {
                console.error("Error from Google Gemini API:", error);
                reply(
                    "Maaf, sepertinya ada yang error saat memproses permintaan."
                );
            }
        } else if (messageContent.toLowerCase() === "#help") {
            try {
                const helpMessage = getHelp(name());

                await new Promise(resolve => setTimeout(resolve, 5000));
                await reply(helpMessage);
            } catch (error) {
                console.error("Error occurred:", error);
            }
        } else if (messageContent.toLowerCase() === "#info") {
            // Handle #info messages
            const infoMessage = getInfo(totalMemory, freeMemory);
            await new Promise(resolve => setTimeout(resolve, 5000));
            await reply(infoMessage);
        } else if (messageContent.toLowerCase() === "#gempa") {
            try {
                const { imgBmkg, dataGempaMessage } = await getGempaData();

                const reactionMessage = {
                    react: {
                        text: "⏳",
                        key: m.key
                    }
                };

                await sock.sendMessage(m.key.remoteJid, reactionMessage);

                await new Promise(resolve => setTimeout(resolve, 2000));

                const removeReaction = {
                    react: {
                        text: "",
                        key: m.key
                    }
                };

                await sock.sendMessage(m.key.remoteJid, {
                    image: { url: imgBmkg },
                    caption: dataGempaMessage
                });
                await sock.sendMessage(m.key.remoteJid, removeReaction);
            } catch (error) {
                console.error("Error saat mengirim data gempa:", error);
                const errorMessage = `Maaf, sepertinya ada yang error saat mengirim data gempa.\nError: ${error.message}`;
                await reply(errorMessage);
            }
        } // End

        // Format log masuk (dari orang lain)
        const logIncomingMessage = () => {
            console.log(
                chalk.white(chalk.bgRed("[ Pesan Masuk ]")),
                "\n",
                chalk.magenta("Name  : "),
                chalk.magenta("[") +
                    color(` ${name()} `, "kuning") +
                    chalk.magenta("]"),
                "\n",
                chalk.magenta("From  : "),
                chalk.magenta("[") +
                    color(` ${nomor()} `, "merah") +
                    chalk.magenta("]"),
                "\n",
                chalk.magenta("Texs  : "),
                chalk.magenta("[") +
                    color(` ${messageContent} `, "turquoise") +
                    chalk.magenta("]"),
                "\n"
            );
        };

        const logOutgoingMessage = () => {
            console.log(
                chalk.black(chalk.bgGreen("[ Pesan Keluar ]")),
                "\n",
                chalk.magenta("Name   : "),
                chalk.magenta("[") +
                    color(` ${name()} `, "kuning") +
                    chalk.magenta("]"),
                "\n",
                chalk.magenta("Nomer  : "),
                chalk.magenta("[") +
                    color(` ${nomor()} `, "kuning") +
                    chalk.magenta("]"),
                "\n",
                chalk.magenta("Pesan  : "),
                chalk.magenta("[") +
                    color(` ${messageContent} `, "turquoise") +
                    chalk.magenta("]"),
                "\n"
            );
        };

        if (isFromMe) {
            logOutgoingMessage();
        } else {
            logIncomingMessage();
        }
    });
}

connectToWhatsApp();
