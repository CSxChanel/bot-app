import fetch from "node-fetch";

export async function getGempaData() {
    const gempaBmkgUrl = process.env.BMKG_GEMPA;
    const responsImgGempa = await fetch(gempaBmkgUrl + "autogempa.json");
    const autoData = await responsImgGempa.json();
    const autoGempa = autoData.Infogempa.gempa;

    const imgBmkg = gempaBmkgUrl + autoGempa.Shakemap;
    const dataGempaMessage = `🕐 *${autoGempa.Tanggal}*, *${autoGempa.Jam}*\n📈 *Magnitude ${autoGempa.Magnitude}*\n⬇️ *Kedalaman ${autoGempa.Kedalaman}*\n📍 *Lokasi* : *${autoGempa.Lintang}*, *${autoGempa.Bujur}*\n*${autoGempa.Wilayah}*\n⁉️ ${autoGempa.Dirasakan}\nPotensi : ${autoGempa.Potensi}\n\nSumber-Data\nhttps://data.bmkg.go.id/#data\n┈━━━〔 BMKG〕━━━┈`;

    return { imgBmkg, dataGempaMessage };
}


