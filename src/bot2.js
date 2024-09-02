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
import chalk from "chalk";
import figlet from "figlet";

import { getHelp, getInfo } from "./setting.js";

import dotenv from "dotenv";
dotenv.config();
const totalMemory = os.totalmem() / 1024 ** 3; // Konversi ke GB
const freeMemory = os.freemem() / 1024 ** 3; // Konversi ke GB
import { GoogleGenerativeAI } from "@google/generative-ai";
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
    const { state, saveCreds } =
        await useMultiFileAuthState("auth_info_baileys");

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
    console.log(
        color(
            figlet.textSync("Wa-OpenAI", {
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

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const messageContent =
            m.message.conversation || // Pesan teks biasa
            m.message.extendedTextMessage?.text || // Pesan teks dengan tambahan context
            (m.message.imageMessage &&
                `[Gambar] ${
                    m.message.imageMessage.caption || "(tidak ada caption)"
                }`) || // Pesan gambar
            (m.message.videoMessage &&
                `[Video] ${
                    m.message.videoMessage.caption || "(tidak ada caption)"
                }`) || // Pesan video
            (m.message.stickerMessage && "[Stiker]") || // Pesan stiker
            ""; // Default jika tidak ada pesan

        // Fungsi untuk mendapatkan nama pengirim
        const name = () => {
            return m.pushName || m.key.remoteJid.split("@")[0];
        };

        // Fungsi untuk nomor telepon pengirim
        const nomor = () => {
            return m.key.remoteJid.split("@")[0];
        };

        // Mengecek apakah pesan dari grup, status, atau direct message
        const isFromGroup = m.key.remoteJid.endsWith("@g.us");
        const isDirectMessage = !isFromGroup;
        const isFromStatus = m.key.remoteJid.includes("status@broadcast");

        // Mengecek apakah pesan dari saya atau orang lain
        const isFromMe = m.key.fromMe;

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

        // Format log dikirim (dari saya)
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

        // log pesan dari saya atau dari orang lain
        if (isFromMe) {
            logOutgoingMessage();
        } else {
            logIncomingMessage();
        }

        const prefix = "#";
        const reply = msg =>
            sock.sendMessage(m.key.remoteJid, { text: msg }, { quoted: m });
        // Menangani pesan gambar
        if (
            m.message.imageMessage &&
            (isDirectMessage || isFromGroup) &&
            !isFromStatus
        ) {
            const responseMessage = await reply(
                `Halo *${name()}* 👋, gambar sedang di proses...`
            );

            try {
                console.log(color("Got an image to process"));
                // Menambahkan reaksi emotikon pada pesan yang sedang diproses
                const reactionMessage = {
                    react: {
                        text: "⏳",
                        key: responseMessage.key // Key dari pesan yang akan diberikan reaksi
                    }
                };

                // Kirim pesan reaksi
                await sock.sendMessage(
                    responseMessage.key.remoteJid,
                    reactionMessage
                );

                // Set timeout 200ms sebelum mulai memproses
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Download the image
                const mediaMessage = await downloadMediaMessage(m, "buffer");
                const filePath = "./temp/image.jpg";
                fs.writeFileSync(filePath, mediaMessage);

                // Convert the image to a Generative AI part
                const imagePart = fileToGenerativePart(filePath, "image/jpeg");

                // Generate a response using Google Gemini
                const prompt =
                    "apa tanggapan kamu dari gambar ini dan jelaskan.";
                const result = await model.generateContent([prompt, imagePart]);
                const generatedText = result.response.text();
                // Menghapus reaksi setelah pemrosesan selesai
                const removeReaction = {
                    react: {
                        text: "", // Emoji kosong untuk menghapus reaksi
                        key: responseMessage.key
                    }
                };

                // Kirim pesan untuk menghapus reaksi
                await sock.sendMessage(
                    responseMessage.key.remoteJid,
                    removeReaction
                );

                // Mengirim hasil dari Gemini
                await reply(generatedText + "\n\nketik *#help*");

                // Clean up the temporary file
                fs.unlinkSync(filePath);
            } catch (error) {
                console.error("Error from Google Gemini API:", error);

                // Menghapus reaksi terjadi error
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
                console.log(color("#pertanyaan :"), cleanedMessage);

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

                // Kirim Reply respon Gemini
                await reply(generatedText + "\n\nketik *#help*");
            } catch (error) {
                console.error("Error from Google Gemini API:", error);
                const errorMessage = `Maaf, sepertinya ada yang error saat memproses pertanyaan.\nError: ${error.message}`;
                await reply(errorMessage);
            }
        } else if (messageContent.toLowerCase() === "#help") {
            const helpMessage = getHelp(name());

            await new Promise(resolve => setTimeout(resolve, 5000));
            await reply(helpMessage);
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
                // Kirim pesan reaksi
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
                // Kirim pesan reaksi
                await sock.sendMessage(m.key.remoteJid, removeReaction);

                await reply(generatedQuote);
            } catch (error) {
                console.error("Error from Google Gemini API:", error);
                reply(
                    "Maaf, sepertinya ada yang error saat memproses permintaan."
                );
            }
        } else if (messageContent.toLowerCase() === "#info") {
            // Handle #info messages
            const infoMessage = getInfo(totalMemory, freeMemory);
            await new Promise(resolve => setTimeout(resolve, 5000));
            await reply(infoMessage);
        }
    });
}

connectToWhatsApp();
