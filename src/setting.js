// #help
export function getHelp(name) {
    return `
Halo! *${name}*\n
Berikut adalah beberapa perintah yang bisa kamu gunakan:

1. *#help* - Untuk menampilkan pesan ini.
2. *#quote* - Untuk mendapatkan kutipan inspiratif.
3. *#gempa* - Untuk mendapatkan info gempa Terkini.
4. *#info* - Untuk mendapatkan informasi tentang bot ini.

Contoh penggunaan: 
- Ketik *#Apa itu Ai ?* untuk bertanya tentang Ai.
- Ketik *#quote* untuk mendapatkan kutipan inspiratif.

Jika ada pertanyaan lebih lanjut, jangan ragu untuk bertanya! 😊
    `;
}

// #info
export function getInfo(totalMemory, freeMemory) {
    return `
╭━━━〔 Info Bot 〕━━━┈
│◦➛ Author : 
│◦➛ No-Hp : 
│◦➛ Url : https://cpsudrajat-movie.vercel.app
│◦➛ Script: https://github.com/CSxChanel/bot-app
│◦➛ Build App : https://gemini.google.com/
│◦➛ All : ${totalMemory.toFixed(2)} GB
│◦➛ Free : ${freeMemory.toFixed(2)} GB
└────────────┈ ⳹\n`;
}
