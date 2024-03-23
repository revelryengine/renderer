import { RenderNode } from '../../render-node.js';

import { vec3, mat4, quat } from '../../../../deps/gl-matrix.js';
import { NonNull, rad2Deg } from '../../../../deps/utils.js';

/**
 * The Audio Node is responsible for spatializing the KHR_audio nodes and outputing via Web Audio
 *
 * @extends {RenderNode<{
 *  settings: import('../standard-settings.js').StandardSettings,
 * }>}
 */
export class AudioNode extends RenderNode {
    #timeLast  = 0;
    #timeDelta = 0;

    get audio() {
        return /** @type {import('../standard-path.js').StandardRenderPath} */(this.renderPath).audio;
    }

    /**
     * @type {RenderNode['run']}
     */
    run() {
        if(!this.audio.context) return; //User has not interacted with the page yet.

        const  { graph, frustum } = this.passData;

        const now = performance.now();
        this.#timeDelta = (now - this.#timeLast) / 1000;
        this.#timeLast = now;

        this.audio.volume = this.settings.values.volume;
        this.audio.muted  = !this.settings.flags.audio;

        const { listener } = this.audio.context;

        this.setListenerNodeTransform(listener, frustum.invViewMatrix);

        if(graph.scene.extensions?.KHR_audio){
            for(const emitter of graph.scene.extensions.KHR_audio.emitters) {
                this.getSceneEmitter(emitter);
            }
        }

        for(const [emitter, emitterNode] of this.#sceneEmitters) {
            if(!graph.scene.extensions?.KHR_audio?.emitters || graph.scene.extensions.KHR_audio.emitters.indexOf(emitter) === -1) {
                emitterNode.disconnect();
                this.#sceneEmitters.delete(emitter);
            }
        }

        for(const node of graph.emitters) {
            const emitterNode = this.getNodeEmitter(node);
            this.setAudioNodeTransform(emitterNode, graph.getWorldTransform(node));
        }

        for(const [node, emitterNode] of this.#nodeEmitters) {
            if(!graph.emitters.has(node)) {
                emitterNode.disconnect();
                this.#nodeEmitters.delete(node);
            }
        }
    }

    /**
     * @type {WeakMap<import('../../../../deps/gltf.js').KHRAudioEmitter|import('../../../../deps/gltf.js').KHRAudioSource, GainNode>}
     */
    #gainNodes = new WeakMap();
    /**
     * @param {import('../../../../deps/gltf.js').KHRAudioEmitter|import('../../../../deps/gltf.js').KHRAudioSource} emitter
     */
    getGainNode(emitter) {
        return this.#gainNodes.get(emitter) ?? NonNull(this.#gainNodes.set(emitter, new GainNode(NonNull(this.audio.context), { gain: emitter.gain })).get(emitter));
    }

    /**
     * @type {Map<import('../../../../deps/gltf.js').KHRAudioEmitter, GainNode>}
     */
    #sceneEmitters = new Map();
    /**
     * @param {import('../../../../deps/gltf.js').KHRAudioEmitter} emitter
     */
    getSceneEmitter(emitter) {
        return this.#sceneEmitters.get(emitter) ?? NonNull(this.#sceneEmitters.set(emitter, this.createSceneEmitter(emitter)).get(emitter));
    }

    /**
     * @param {import('../../../../deps/gltf.js').KHRAudioEmitter} emitter
     */
    createSceneEmitter(emitter) {
        const emitterGain = this.getGainNode(emitter);
        for(const source of emitter.sources) {
            this.getSourceNode(source).connect(emitterGain);
        }

        emitterGain.connect(this.audio.master);
        return emitterGain;
    }

    #nodeEmitters = new Map();
    /**
     * @param {import('../../../graph.js').EmitterNode} node
     */
    getNodeEmitter(node) {
        return this.#nodeEmitters.get(node) ?? NonNull(this.#nodeEmitters.set(node, this.createNodeEmitter(node)).get(node));
    }

    /**
     * @param {import('../../../graph.js').EmitterNode} node
     */
    createNodeEmitter(node) {
        const  { graph } = this.passData;

        const { emitter } = node.extensions?.KHR_audio;

        const emitterPan = new PannerNode(NonNull(this.audio.context), {
            panningModel: 'HRTF',
            ...emitter.positional,
            coneInnerAngle: emitter.positional && rad2Deg(emitter.positional.coneInnerAngle),
            coneOuterAngle: emitter.positional && rad2Deg(emitter.positional.coneOuterAngle),
        });

        this.setAudioNodeTransform(emitterPan, graph.getWorldTransform(node));

        const emitterGain = this.getGainNode(emitter);
        for(const source of emitter.sources) {
            this.getSourceNode(source).connect(emitterPan);
        }

        emitterPan.connect(emitterGain).connect(this.audio.master);
        return emitterPan;
    }

    /**
     * @param {AudioListener} audioNode
     * @param {mat4} transform
     */
    setListenerNodeTransform(audioNode, transform) {
        const t = mat4.getTranslation(vec3.create(), transform);
        const q = mat4.getRotation(quat.create(), transform);
        const o = vec3.transformQuat(vec3.create(), [0, 0, -1], q);
        const u = vec3.transformQuat(vec3.create(), [0, 1, 0], q);

        vec3.normalize(o, o);
        vec3.normalize(u, u);


        if(audioNode.positionX) {
            const endTime = NonNull(this.audio.context).currentTime + this.#timeDelta;

            audioNode.positionX.linearRampToValueAtTime(t[0], endTime);
            audioNode.positionY.linearRampToValueAtTime(t[1], endTime);
            audioNode.positionZ.linearRampToValueAtTime(t[2], endTime);
            audioNode.forwardX.linearRampToValueAtTime(o[0], endTime);
            audioNode.forwardY.linearRampToValueAtTime(o[1], endTime);
            audioNode.forwardZ.linearRampToValueAtTime(o[2], endTime);
            audioNode.upX.linearRampToValueAtTime(u[0], endTime);
            audioNode.upY.linearRampToValueAtTime(u[1], endTime);
            audioNode.upZ.linearRampToValueAtTime(u[2], endTime);
        } else {
            // @ts-ignore
            audioNode.setPosition(...t);
            // @ts-ignore
			audioNode.setOrientation(...o, ...u);
        }

    }

    /**
     * @param {PannerNode} audioNode
     * @param {mat4} transform
     */
    setAudioNodeTransform(audioNode, transform) {
        const t = mat4.getTranslation(vec3.create(), transform);
        const q = mat4.getRotation(quat.create(), transform);
        const o = vec3.transformQuat(vec3.create(), [0, 0, 1], q);

        vec3.normalize(o, o);

        if(audioNode.positionX) {
            const endTime = NonNull(this.audio.context).currentTime + this.#timeDelta;

            audioNode.positionX.linearRampToValueAtTime(t[0], endTime);
            audioNode.positionY.linearRampToValueAtTime(t[1], endTime);
            audioNode.positionZ.linearRampToValueAtTime(t[2], endTime);

            audioNode.orientationX.linearRampToValueAtTime(o[0], endTime);
            audioNode.orientationY.linearRampToValueAtTime(o[1], endTime);
            audioNode.orientationZ.linearRampToValueAtTime(o[2], endTime);
        } else {
            // @ts-ignore
            audioNode.setPosition(...t);
            // @ts-ignore
			audioNode.setOrientation(...o);
        }
    }

    #sourceNodes = new WeakMap();
    /**
     * @param {import('../../../../deps/gltf.js').KHRAudioSource} source
     */
    getSourceNode(source) {
        return this.#sourceNodes.get(source) ?? NonNull(this.#sourceNodes.set(source, this.createSourceNode(source)).get(source));
    }

    /**
     * @param {import('../../../../deps/gltf.js').KHRAudioSource} source
     */
    createSourceNode(source) {
        const gain         = this.getGainNode(source);
        const bufferSource = new AudioBufferSourceNode(NonNull(this.audio.context));

        bufferSource.loop = source.loop;
        this.audio.decode(source.audio).then(audioBuffer => {
            bufferSource.buffer = audioBuffer;
            if(source.autoPlay) bufferSource.start();
        });

        bufferSource.connect(gain);
        return gain;
    }

    destroy() {
        for(const node of [...this.#sceneEmitters.values(), ...this.#nodeEmitters.values()]) {
            node.disconnect();
            this.#sceneEmitters.clear();
            this.#nodeEmitters.clear();
        }
    }
}

