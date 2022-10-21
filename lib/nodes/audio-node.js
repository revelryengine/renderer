import { RenderNode } from './render-node.js';
import { vec3, mat4, quat } from '../../deps/gl-matrix.js';
import { radiansToDegrees } from '../utils.js';

/**
 * The Audio Node is responsible for spatializing the KHR_audio nodes and outputing via Web Audio
 */
export class AudioNode extends RenderNode {
    #timeLast  = 0;
    #timeDelta = 0;

    get audio() {
        return this.renderPath.audio;
    }

    get settings() {
        return this.renderPath.settings.audio;
    }

    run(commandEncoder, { graph, frustum }) {
        if(!this.audio.context) return; //User has not interacted with the page yet.

        if(!this.settings.enabled) {
            for(const node of [...this.#sceneEmitters.values(), ...this.#nodeEmitters.values()]) {
                node.disconnect();
                this.#sceneEmitters.clear();
                this.#nodeEmitters.clear();
            }
            return;
        }

        const now = performance.now();
        this.#timeDelta = (now - this.#timeLast) / 1000;
        this.#timeLast = now;

        this.audio.volume = this.settings.volume;
        this.audio.muted  = this.settings.muted;

        const { listener } = this.audio.context;

        this.setListenerNodeTransform(listener, frustum.invViewMatrix);
        
        if(graph.scene.extensions?.KHR_audio){
            for(const emitter of graph.scene.extensions.KHR_audio.emitters) {
                this.getSceneEmitter(emitter);
            }
        }

        for(const [emitter, emitterNode] of this.#sceneEmitters) {
            if(!graph.scene.extensions.KHR_audio?.emitters || graph.scene.extensions.KHR_audio.emitters.indexOf(emitter) === -1) {
                emitterNode.disconnect();
                this.#sceneEmitters.delete(emitter);
            }
        }

        for(const node of graph.audio) {
            const emitterNode = this.getNodeEmitter(graph, node);
            this.setAudioNodeTransform(emitterNode, graph.getWorldTransform(node));
        }

        for(const [node, emitterNode] of this.#nodeEmitters) {
            if(graph.audio.indexOf(node) === -1) {
                emitterNode.disconnect();
                this.#nodeEmitters.delete(node);
            }
        }
    }

    #gainNodes = new WeakMap();
    getGainNode(obj) {
        return this.#gainNodes.get(obj) || this.#gainNodes.set(obj, new GainNode(this.audio.context, { gain: obj.gain })).get(obj); 
    }

    #sceneEmitters = new Map();
    getSceneEmitter(emitter) {
        return this.#sceneEmitters.get(emitter) || this.#sceneEmitters.set(emitter, this.createSceneEmitter(emitter)).get(emitter);
    }

    createSceneEmitter(emitter) {
        const emitterGain = this.getGainNode(emitter);
        for(const source of emitter.sources) {
            this.getSourceNode(source).connect(emitterGain);
        }

        emitterGain.connect(this.audio.master);
        return emitterGain;
    }

    #nodeEmitters = new Map();
    getNodeEmitter(graph, node) {
        return this.#nodeEmitters.get(node) || this.#nodeEmitters.set(node, this.createNodeEmitter(graph, node)).get(node);
    }

    createNodeEmitter(graph, node) {
        const { emitter } = node.extensions.KHR_audio;

        const emitterPan = new PannerNode(this.audio.context, { 
            panningModel: 'HRTF',
            ...emitter.positional,
            coneInnerAngle: radiansToDegrees(emitter.positional.coneInnerAngle),
            coneOuterAngle: radiansToDegrees(emitter.positional.coneOuterAngle),
        });

        this.setAudioNodeTransform(emitterPan, graph.getWorldTransform(node));

        const emitterGain = this.getGainNode(emitter);
        for(const source of emitter.sources) {
            this.getSourceNode(source).connect(emitterPan);
        }

        emitterPan.connect(emitterGain).connect(this.audio.master);
        return emitterPan;
    }

    setListenerNodeTransform(audioNode, transform) {
        const t = mat4.getTranslation(vec3.create(), transform);
        const q = mat4.getRotation(quat.create(), transform);
        const o = vec3.transformQuat(vec3.create(), [0, 0, -1], q);
        const u = vec3.transformQuat(vec3.create(), [0, 1, 0], q);

        vec3.normalize(o, o);
        vec3.normalize(u, u);

        const endTime = this.audio.context.currentTime + this.#timeDelta;

        audioNode.positionX.linearRampToValueAtTime(t[0], endTime);
        audioNode.positionY.linearRampToValueAtTime(t[1], endTime);
        audioNode.positionZ.linearRampToValueAtTime(t[2], endTime);
        audioNode.forwardX.linearRampToValueAtTime(o[0], endTime);
        audioNode.forwardY.linearRampToValueAtTime(o[1], endTime);
        audioNode.forwardZ.linearRampToValueAtTime(o[2], endTime);
        audioNode.upX.linearRampToValueAtTime(u[0], endTime);
        audioNode.upY.linearRampToValueAtTime(u[1], endTime);
        audioNode.upZ.linearRampToValueAtTime(u[2], endTime);
    }

    setAudioNodeTransform(audioNode, transform) {
        const t = mat4.getTranslation(vec3.create(), transform);
        const q = mat4.getRotation(quat.create(), transform);
        const o = vec3.transformQuat(vec3.create(), [0, 0, 1], q);

        vec3.normalize(o, o);

        const endTime = this.audio.context.currentTime + this.#timeDelta;

        audioNode.positionX.linearRampToValueAtTime(t[0], endTime);
        audioNode.positionY.linearRampToValueAtTime(t[1], endTime);
        audioNode.positionZ.linearRampToValueAtTime(t[2], endTime);

        audioNode.orientationX.linearRampToValueAtTime(o[0], endTime);
        audioNode.orientationY.linearRampToValueAtTime(o[1], endTime);
        audioNode.orientationZ.linearRampToValueAtTime(o[2], endTime);
    }

    #audioBuffers = new WeakMap();
    getAudioBuffer(audio) {
        return this.#audioBuffers.get(audio) || this.#audioBuffers.set(audio, this.audio.context.decodeAudioData(audio.getArrayBuffer())).get(audio);
    }

    #sourceNodes = new WeakMap();
    getSourceNode(source) {
        return this.#sourceNodes.get(source) || this.#sourceNodes.set(source, this.createSourceNode(source)).get(source);
    }

    createSourceNode(source) {
        const gain         = this.getGainNode(source);
        const bufferSource = new AudioBufferSourceNode(this.audio.context);
        
        bufferSource.loop = source.loop;
        this.getAudioBuffer(source.audio).then(audioBuffer => {
            bufferSource.buffer = audioBuffer;
            if(source.autoPlay) bufferSource.start();
        });
        
        bufferSource.connect(gain);
        return gain;
    }
}

export default AudioNode;