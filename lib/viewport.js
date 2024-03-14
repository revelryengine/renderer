/**
 *  @typedef {import('../deps/gltf.js').Node & { camera: import('../deps/gltf.js').Camera }} ViewportCameraNode
 *  @typedef {({ type: 'canvas', canvas: HTMLCanvasElement|OffscreenCanvas } | { type: 'texture', texture: import('./revgal.js').REVTexture }) & { x?: number, y?: number, width?: number, height?: number }} ViewportTarget
 */

import { GameObjectFilter, Graph } from './graph.js';
import { RenderPath } from './render-paths/render-path.js';
import { Renderer   } from './renderer.js';
import { Frustum    } from './frustum.js'

/**
 * @template {Revelry.Renderer.RenderPathKeys} [K=any]
 * @template {ViewportTarget} [T=ViewportTarget]
 */
export class Viewport {
    /**
     * @param {import('./revgal.js').RevGAL} gal
     * @param {{ target: T, renderPath: K } & Revelry.Renderer.RenderPathSettingsOptions<K>} options
     */
    constructor(gal, { target, renderPath, flags, values }) {
        this.width   = target.width  ?? (target.type === 'canvas' ? target.canvas.width : target.texture.width);
        this.height  = target.height ?? (target.type === 'canvas' ? target.canvas.height : target.texture.height);

        this.gal     = gal;
        this.target  = target;

        this.renderPath = new RenderPath.registry[renderPath](this);
        this.frustum    = new Frustum(gal, this);

        this.reconfigure(flags, values);
    }


    /**
     * @param {Revelry.Renderer.RenderPathSettingsFlags<K>} [flags]
     * @param {Revelry.Renderer.RenderPathSettingsValues<K>} [values]
     */
    reconfigure(flags, values) {
        if(this.target.type === 'canvas') {
            const { canvas } = this.target;

            const width  = Math.floor(canvas.width);
            const height = Math.floor(canvas.height);

            if(this.width !== width || this.height !== height) {
                this.width  = width;
                this.height = height;
            }
        }

        this.renderPath.reconfigure(flags, values);
    }

    /**
     * @param {(
     *  { graph: Graph, cameraNode: ViewportCameraNode, filter?: ConstructorParameters<typeof GameObjectFilter>[0] } & Revelry.Renderer.RenderPaths[K]['options']
     * )} options
     */
    render({ graph, cameraNode, filter, ...options }) {
        if(!this.width || !this.height) return; // Don't bother rendering to a target with no size

        if(this.width > this.gal.context.canvas.width || this.height > this.gal.context.canvas.height) {
            this.gal.context.canvas.width  = this.width;
            this.gal.context.canvas.height = this.height;
            this.gal.reconfigure();
        }

        //update frustum from camera and graph

        const { frustum } = this;
        const { settings, path, prePath  } = this.renderPath;

        const commandEncoder = this.gal.device.createCommandEncoder();

        const sortAlpha = !!(settings && 'sortAlpha' in settings && settings.sortAlpha);

        frustum.update({ graph, cameraNode });
        graph.update(settings);

        const instances = graph.generateInstances({ frustum, sortAlpha, filter: new GameObjectFilter(filter) });

        for(const node of prePath) {
            node.run(commandEncoder, { graph, frustum, instances, ...options });
        }

        for(const node of path) {
            node.run(commandEncoder, { graph, frustum, instances, ...options });
        }

        this.gal.device.queue.submit([commandEncoder.finish()]);

        if('canvas' in this.target) {
            const context = /** @type {CanvasRenderingContext2D} */(this.target.canvas.getContext('2d'));

            const aspectRatio = cameraNode.camera.getAspectRatio();

            const [sX, sY, sWidth, sHeight] = frustum.uniformViewport;

            let dX      = this.target.x ?? 0;
            let dY      = this.target.y ?? 0;
            let dWidth  = this.target.width ?? this.target.canvas.width;
            let dHeight = this.target.height ?? this.target.canvas.height;

            if(aspectRatio) {
                const [uX, uY, uWidth, uHeight] = Frustum.uniformScale(dWidth, dHeight, aspectRatio ?? 1);

                context.clearRect(dX + uX, dY + uY, uWidth, uHeight);
                context.drawImage(this.gal.context.canvas, sX, sY, sWidth, sHeight, dX + uX, dY + uY, uWidth, uHeight);
            } else {
                context.clearRect(dX, dY, dWidth, dHeight);
                context.drawImage(this.gal.context.canvas, sX, sY, sWidth, sHeight, dX, dY, dWidth, dHeight);
            }
        }
    }

    /**
     * @param {Graph} graph
     */
    async precompile(graph) {
        return this.renderPath.precompile(graph);
    }

    destroy() {
        this.renderPath.destroy();
    }
}
