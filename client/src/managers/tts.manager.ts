import { OptionObj } from "../components/Input.component"
import { md2html } from "./markdown.manager"
import { regexs } from '../../../shared/helpers/regexs.helper';
import { each, debounce } from "lodash";

export const cleanText2Speech = (rawText: string) => {
	let text2read = rawText
	text2read = text2read.replace(regexs.ressource, '')
	text2read = text2read.replace(regexs.ref, '')
	text2read = text2read.replace(regexs.baliseHtml, '')
	text2read = text2read.replace(/<[^>]*>?/gm, ' '); // remove html tags
	text2read = text2read.replace(/((&lt;!--).+?(--&gt;))/gm, ' '); // remove html comments
	text2read = text2read.replace(/(<!--).+?(-->)/gm, ' '); // remove html comments
	text2read = text2read.replace(/(\r\n|\n|\r)/gm, " "); // \n \r jumps
	text2read = text2read.replace(/(\r\n|\n|\r)/gm, " "); // \n \r jumps
	
	return text2read
}

export const removeTextLineJumps = (raw: string): string => {
	return raw.replace(/(\r\n\r\n|\n\n|\r\r|\n)/gm, ".");
}

export const getAvailableVoices = () => {
	let newvoices: OptionObj[] = []
	window.speechSynthesis.getVoices().forEach(function (voice, i) {
		const lang = voice.lang ? ` (${voice.lang})` : ''
		const label = `${voice.name}${lang}`
		newvoices.push({ key: i, label, obj: voice })
	});
	return newvoices
}

export class Text2SpeechManager {
	rawText: string
	voice: any
	text2read: string
	chunkedText: string[]

	chunkLength: number = 1000 // 160 if tts stops (bug)
	currChunkId: number = 0
	currSpeechObj: any
	speed: number = 1

	isLoaded: boolean = false
	shouldStop: boolean = false

	constructor(p: {
		text: string
	}) {
		this.rawText = p.text
		this.text2read = cleanText2Speech(p.text)
		this.chunkedText = this.chunkText(this.text2read)
		console.log(`[TTS] init new manager `, { p, text: this.chunkedText, length: this.chunkedText.length });
	}

	chunkText = (text2chunk: string): string[] => {
		// 1 remove spaces
		text2chunk = removeTextLineJumps(text2chunk)

		// 2 split by sentences
		let sentences = text2chunk.split(/[.!?]+/)

		// 3 reduce again if sentences too long
		let chunks: string[] = []
		for (let i = 0; i < sentences.length; i++) {
			const sentence = sentences[i];
			if (sentence.length > this.chunkLength) {
				// subchunks from words
				let words = sentence.split(' ')
				let newSentence = ''
				for (let y = 0; y < words.length; y++) {
					newSentence += words[y] + ' '


					if (newSentence.length > this.chunkLength || y === words.length - 1) {
						// console.log( 'PUSH', newSentence);
						chunks.push(newSentence)
						newSentence = ''
					}
				}
			} else {
				chunks.push(sentence)
			}
		}
		// console.log(chunks);
		return chunks
	}

	loadVoice = (voice) => {
		console.log(`[TTS] LOAD VOICE`, voice);
		this.voice = voice
		this.pause()
		this.play()
	}

	updateSpeed = (speed: number) => {
		this.speed = speed
		this.pause()
		this.play()
	}

	play = () => {

		if (!this.isLoaded) {

			if (this.currChunkId > this.chunkedText.length - 1) return console.log(`[TTS] finished played`)

			this.isLoaded = true
			this.currSpeechObj = new SpeechSynthesisUtterance();
			this.currSpeechObj.text = this.chunkedText[this.currChunkId]
			this.currSpeechObj.rate = this.speed
			if (this.voice) this.currSpeechObj.voice = this.voice

			// apparently important to keep that console.log...

			setTimeout(() => {
				window.speechSynthesis.speak(this.currSpeechObj);
			}, 0);

			this.currSpeechObj.addEventListener('end', () => {
				this.isLoaded = false
				// console.log(`[TTS] END play chunk ${this.currChunkId}`);
				if (!this.shouldStop) {
					// window.speechSynthesis.cancel();
					this.currChunkId += 1
					this.play()
				} else {
					this.shouldStop = false
				}
			})

		} else {
			// console.log(`[TTS] RESUME play chunk ${this.currChunkId}`);
			window.speechSynthesis.resume();
		}
	}

	isPlaying = (): boolean => {
		let res = window.speechSynthesis.speaking
		if (res) res = !window.speechSynthesis.paused
		return res;
	}

	pause = () => {
		// console.log('[TTS] pause');
		// window.speechSynthesis.pause();
		this.stop()
	}

	stop = () => {
		// console.log('[TTS] stop');
		this.shouldStop = true
		this.isLoaded = false
		this.debounceReinitStop()
		window.speechSynthesis.cancel();
	}

	// needed for edge to not stop after first sentence after a restart/gotochunk
	debounceReinitStop = debounce(() => {
		this.shouldStop = false
	}, 1000)

	goToChunk = (chunkNb: number) => {
		// console.log('[TTS] goToChunk', chunkNb);
		if (chunkNb <= 0 || chunkNb > this.chunkedText.length - 1) return
		this.currChunkId = chunkNb

		// IF PLAYING => stop and play one asked
		if (this.isPlaying()) {
			this.debounceRestart()
		}
	}

	extractToChunkPos = (extract: string): number => {
		let extractChunks = this.chunkText(extract)
		let toSearch: string | null = null
		each(extractChunks, c => {
			if (c.length > 50) {
				toSearch = c
				return false
			}
		})
		if (!toSearch) return -1

		let res = -1
		each(this.chunkedText, (chunk, i) => {
			if (chunk.indexOf(toSearch as string) !== -1) {
				res = i
				return false
			}
		})
		return res
	}

	getCurrentChunkText = (): string | null => {
		let res: string | null = null
		res = this.chunkedText[this.currChunkId]
		return res
	}



	debounceRestart = debounce(() => {
		// console.log('DEBOUNCE RESTART');
		this.stop()
		// this.shouldStop = false
		this.play()
	}, 500)

	goBack = () => {
		// console.log('[TTS] goBack', this.currChunkId);
		this.goToChunk(this.currChunkId - 1)
	}
	goForward = () => {
		// console.log('[TTS] goForward', this.currChunkId);
		this.goToChunk(this.currChunkId + 1)
	}

}


