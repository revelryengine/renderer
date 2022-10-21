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
            window.removeEventListener(action, initAudioContext);
        }
    
        audioContext = new AudioContext();
        resolve(audioContext);
    }
    
    for(const action of interactions) {
        window.addEventListener(action, initAudioContext);
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
}

export default AudioController;