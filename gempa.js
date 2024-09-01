import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const gempaBmkgUrl = process.env.GEMPA_NEW;

if (!gempaBmkgUrl) {
    console.error("URL API BMKG tidak ditemukan dalam file");
    process.exit(1);
}

try {
    const respons = await fetch(gempaBmkgUrl);
    const data = await respons.json();
    // const {
    //     Infogempa: { gempa }
    // } = await respons.json();

    const firstGempa = data.Infogempa.gempa[0];

    console.log(firstGempa);
} catch (error) {
    console.error("Terjadi kesalahan saat mengambil data:", error);
}
