/**
 * @typedef {import('../deps/gltf.js').Node & { camera: import('../deps/gltf.js').Camera }} ViewportCameraNode
 * @typedef {{ type: 'canvas',  canvas:  HTMLCanvasElement|OffscreenCanvas }} ViewportCanvasTarget
 * @typedef {{ type: 'texture', texture: import('./revgal.js').REVTexture  }} ViewportTextureTarget
 * @typedef {{ type: 'virtual', virtual: { width: number, height: number } }} ViewportVirtualTarget
 * @typedef {(ViewportCanvasTarget | ViewportTextureTarget | ViewportVirtualTarget) & { x?: number, y?: number, width?: number, height?: number }} ViewportTarget
 */

import { GameObjectFilter, Graph } from './graph.js';
import { Frustum } from './frustum.js';

/**
 * @template {import('./render-paths/render-path.js').RenderPath} R
 * @template {ViewportTarget} [T=ViewportTarget]
 */
export class Viewport {
    /**
     * @param {import('./revgal.js').RevGAL} gal
     * @param {{ target: T, renderPath: R }} options
     */
    constructor(gal, { target, renderPath }) {
        this.width   = target.width  ?? (target.type === 'canvas' ? target.canvas.width  : target.type === 'texture' ? target.texture.width  : target.virtual.width);
        this.height  = target.height ?? (target.type === 'canvas' ? target.canvas.height : target.type === 'texture' ? target.texture.height : target.virtual.height);

        this.gal     = gal;
        this.target  = target;

        this.renderPath = renderPath;
        this.frustum    = new Frustum(gal, this);
    }


    /**
     * @param {{ flags?: Parameters<R['reconfigure']>[0], values?: Parameters<R['reconfigure']>[1] }} [config]
     */
    reconfigure({ flags, values } = {}) {
        let target;

        switch (this.target.type) {
            case 'canvas':
                target = this.target.canvas;
                break;
            case 'texture':
                target = this.target.texture;
                break;
            case 'virtual':
                target = this.target.virtual;
                break;
        }

        const width  = Math.floor(target.width);
        const height = Math.floor(target.height);

        if(this.width !== width || this.height !== height) {
            this.width  = width;
            this.height = height;
        }

        this.renderPath.width  = this.width;
        this.renderPath.height = this.height;
        this.renderPath.reconfigure(flags, values);
    }

    /**
     * @param {(
     *  { graph: Graph, cameraNode: ViewportCameraNode, filter?: ConstructorParameters<typeof GameObjectFilter>[0] }
     * )} options
     */
    render({ graph, cameraNode, filter }) {
        if(!this.width || !this.height) return; // Don't bother rendering to a target with no size

        if(this.width > this.gal.context.canvas.width || this.height > this.gal.context.canvas.height) {
            this.gal.context.canvas.width  = this.width;
            this.gal.context.canvas.height = this.height;
            this.gal.reconfigure();
        }

        //update frustum from camera and graph

        const { frustum  } = this;
        const { settings } = this.renderPath;

        const sortAlpha = !!('sortAlpha' in settings && settings.sortAlpha);

        frustum.update({ graph, cameraNode, jitter: !!settings.flags.jitter });
        graph.update(settings);

        const instances = graph.generateInstances({ frustum, sortAlpha, filter: new GameObjectFilter(filter) });

        this.renderPath.run({ graph, frustum, instances });

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
