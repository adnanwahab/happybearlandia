const transliteration = `
  Allahu la illaha illa huwa al-hayul al-qayum

  La takhuduhu Sinatun Wa La Nawm

  Lahu ma fisamawati wa ma fil al-ard

  Man Dha Al-ladhi Yasha'u 'Indahu 'Illa Bi'idhnih

  Ya \`lamu Ma Bayna Aydhim Wa Ma Khalfahum

  Wa la Yuhituna Bishayim Min limihi illa Bima Sha'a

  Wasi'a Kurshiyuhu As-Samawati Wa Al-Arda

  Wa La Ya\`uduhu Hifzuhuma

  Wa Huwa Al-Aliy Al-Azim`

const sentences = transliteration.trim().split(/\n\s*\n/)
let sentenceIndex = 0

function writeNextSentence() {
  document.querySelector('.transliteration').textContent = sentences[sentenceIndex]
  sentenceIndex = (sentenceIndex + 1) % sentences.length
}

writeNextSentence()
setInterval(writeNextSentence, 10000)

console.log('index.js')
