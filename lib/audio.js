export let audioContext = null;
export const audioContextPromise = new Promise(resolve => {
    const interactions = [
        'click',
        'contextmenu',
        'auxclick',
        'dblclick',
        'mousedown',
        'mouseup',
        'pointerup',
        'touchend',
        'keydown',
        'keyup',
    ];
    
    const initAudioContext = (e) => {
        if((e.type === 'keydown' || e.type === 'keyup') && e.charCode === 0) return;

        for(const action of interactions) {
            self.removeEventListener(action, initAudioContext);
        }
    
        audioContext = new AudioContext();
        resolve(audioContext);
    }
    
    for(const action of interactions) {
        self.addEventListener(action, initAudioContext);
    }
});

export class AudioController {
    #volume = 1;
    #muted  = false;

    constructor() {
        this.contextPromise = audioContextPromise.then((audioContext) => {
            this.context = audioContext;
            this.master  = new GainNode(this.context);

            if(!this.#muted) this.master.gain.value = this.#volume;

            this.master.connect(this.context.destination);
        });
    }

    get volume() {
        return this.#volume;
    }

    set volume(v) {
        this.#volume = v;
        if(!this.#muted && this.master) this.master.gain.value = v;
    }

    get muted() {
        return this.#muted;
    }

    set muted(muted) {
        this.#muted = muted;
        if(this.master) this.master.gain.value = muted ? 0 : this.#volume;
    }

    #decoded = new WeakMap();
    async decode(audio) {
        await this.contextPromise;
        return this.#decoded.get(audio) || this.#decoded.set(audio, this.context.decodeAudioData(audio.getArrayBuffer())).get(audio);
    }
}

export default AudioController;