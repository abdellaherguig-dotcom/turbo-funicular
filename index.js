const fs = require("fs");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const yts = require("yt-search");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

/* -------------------- WHATSAPP CLIENT -------------------- */

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "session" }),
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-software-rasterizer",
            "--disable-features=VizDisplayCompositor"
        ]
    }
});

client.on("qr", qr => qrcode.generate(qr, { small: true }));
client.on("ready", () => console.log("BOT IS RUNNING ✔"));

/* -------------------- API CONFIG -------------------- */

const izumi = {
    baseURL: "https://izumiiiiiiii.dpdns.org"
};

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
    }
};

async function tryRequest(getter, attempts = 3) {
    let last;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            last = err;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw last;
}

async function getIzumiVideoByUrl(url) {
    const apiURL = `${izumi.baseURL}/downloader/youtube?url=${encodeURIComponent(url)}&format=720`;
    const res = await tryRequest(() => axios.get(apiURL, AXIOS_DEFAULTS));
    if (res?.data?.result?.download) return res.data.result;
    throw new Error("Izumi returned no download URL");
}

async function getOkatsuVideoByUrl(url) {
    const apiURL = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`;
    const res = await tryRequest(() => axios.get(apiURL, AXIOS_DEFAULTS));

    if (res?.data?.result?.mp4) {
        return {
            download: res.data.result.mp4,
            title: res.data.result.title
        };
    }
    throw new Error("Okatsu returned no mp4");
}

/* -------------------- MAIN MESSAGE HANDLER -------------------- */

client.on("message", async msg => {
    const chatId = msg.from;
    const text = msg.body.trim();

    const isYTLink =
        text.includes("youtube.com") ||
        text.includes("youtu.be");

    /* ---------- If it's a YouTube link → download ---------- */
    if (isYTLink) {
        await msg.reply("⏳ Downloading your YouTube video...");

        try {
            let data;

            try {
                data = await getIzumiVideoByUrl(text);
            } catch {
                data = await getOkatsuVideoByUrl(text);
            }

            const media = await MessageMedia.fromUrl(data.download, {
                unsafeMime: true
            });

            await client.sendMessage(chatId, media, {
                caption: `*${data.title || "Video"}*\n\nDownloaded ✔`
            });

        } catch (err) {
            msg.reply("❌ Error downloading video.\n" + err.message);
        }

        return;
    }

    /* ---------- Otherwise → YouTube search (yt-search) ---------- */
    try {
        const search = await yts(text);

        if (!search.videos || search.videos.length === 0) {
            msg.reply("❌ No videos found.");
            return;
        }

        const video = search.videos[0];

        await msg.reply(`🎬 *${video.title}*\n${video.url}\n\nDownloading...`);

        let data;
        try {
            data = await getIzumiVideoByUrl(video.url);
        } catch {
            data = await getOkatsuVideoByUrl(video.url);
        }

        const media = await MessageMedia.fromUrl(data.download, {
            unsafeMime: true
        });

        await client.sendMessage(msg.from, media, {
            caption: `*${data.title || video.title}*\n\nDownloaded ✔`
        });

    } catch (err) {
        msg.reply("❌ Error searching YouTube.\n" + err.message);
    }
});

/* -------------------- START BOT -------------------- */
client.initialize();
