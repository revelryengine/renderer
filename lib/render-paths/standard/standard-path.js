import { RenderPath } from '../render-path.js';

import { StandardSettings } from './standard-settings.js';
import { AudioController  } from './audio.js';

import { PostNode    } from '../common/nodes/post-node.js';
import { OutputNode  } from '../common/nodes/output-node.js';
import { GridNode    } from '../common/nodes/grid-node.js';
import { TAANode     } from '../common/nodes/taa-node.js';
import { OutlineNode } from '../common/nodes/outline-node.js';

import { AudioNode       } from './nodes/audio-node.js';
import { EnvironmentNode } from './nodes/environment-node.js';
import { PunctualNode    } from './nodes/punctual-node.js';
import { BaseNode        } from './nodes/base-node.js';
import { MainNode        } from './nodes/main-node.js';
import { LensNode        } from './nodes/lens-node.js';
import { SSAONode        } from './nodes/ssao-node.js';
import { BloomNode       } from './nodes/bloom-node.js';
import { MotionBlurNode  } from './nodes/motion-blur-node.js';


/**
 * @extends {RenderPath<{
 *  nodes: {
 *      main:         MainNode,
 *      output:       OutputNode,
 *      post:         PostNode,
 *      audio?:       AudioNode,
 *      environment?: EnvironmentNode,
 *      punctual?:    PunctualNode,
 *      base?:        BaseNode,
 *      ssao?:        SSAONode,
 *      grid?:        GridNode,
 *      taa?:         TAANode,
 *      outline?:     OutlineNode,
 *      bloom?:       BloomNode,
 *      lens?:        LensNode,
 *      motionBlur?:  MotionBlurNode,
 * },
 * preNodes: {
 *    audio?:       AudioNode,
 *    environment?: EnvironmentNode,
 *    punctual?:    PunctualNode,
 * }
 * }>}
 */
export class StandardRenderPath extends RenderPath {
    settings = new StandardSettings(this.gal);

    audio = new AudioController();

    reconfigureNodePath() {
        const { settings, nodes, preNodes } = this;

        nodes.main   ??= new MainNode(this);
        nodes.output ??= new OutputNode(this);

        if(settings.flags.passiveInput || settings.flags.transmission || settings.flags.ssao) {
            nodes.base ??= new BaseNode(this);
        } else {
            nodes.base?.destroy();
            delete nodes.base;
        }

        if(settings.flags.transmission) {
            this.connect(nodes.base, nodes.main, { color: 'transmission' });
        } else {
            this.disconnect(nodes.main, 'transmission');
        }

        if(settings.flags.ssao) {
            nodes.ssao ??= new SSAONode(this);
            this.connect(nodes.base, nodes.ssao, { point: 'point' });
            this.connect(nodes.ssao, nodes.main, { color: 'ssao' });
        } else {
            this.disconnect(nodes.ssao, 'point');
            this.disconnect(nodes.main, 'ssao');

            nodes.ssao?.destroy();
            delete nodes.ssao;
        }


        const envConnections = { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT' };
        if(settings.flags.environment) {
            preNodes.environment ??= new EnvironmentNode(this);

            this.connect(preNodes.environment, nodes.base, envConnections);
            this.connect(preNodes.environment, nodes.main, envConnections);
        } else {
            this.disconnect(nodes.base, ...Object.values(envConnections));
            this.disconnect(nodes.main, ...Object.values(envConnections));

            preNodes.environment?.destroy();
            delete preNodes.environment;
        }

        const punConnections = { punctual: 'punctual', depth: 'shadows', shadowsSampler: 'shadowsSampler' };
        if(settings.flags.punctual) {
            preNodes.punctual ??= new PunctualNode(this);

            this.connect(preNodes.punctual, nodes.main, punConnections);
            this.connect(preNodes.punctual, nodes.base, punConnections);
        } else {
            this.disconnect(nodes.main, ...Object.values(punConnections));
            this.disconnect(nodes.base, ...Object.values(punConnections));

            preNodes.punctual?.destroy();
            delete preNodes.punctual;
        }

        nodes.post = new PostNode(this, this.reconfigurePostNodePath());
        this.connect(nodes.main, nodes.post,   { color: 'color', depth: 'depth', motion: 'motion' });
        this.connect(nodes.post, nodes.output, { color: 'color' });

        if(settings.flags.audio) {
            preNodes.audio ??= new AudioNode(this);
            this.connect(preNodes.audio, nodes.output, { audio: 'audio' });
        } else {
            preNodes.audio?.destroy();
            delete preNodes.audio;
        }
    }

    reconfigurePostNodePath() {
        const { settings, nodes } = this;

        if(settings.flags.grid) {
            nodes.grid ??= new GridNode(this);
        } else {
            nodes.grid?.destroy();
            delete nodes.grid;
        }

        if(settings.flags.taa) {
            nodes.taa ??= new TAANode(this);
        } else {
            nodes.taa?.destroy();
            delete nodes.taa;
        }

        if(settings.flags.outline) {
            nodes.outline ??= new OutlineNode(this);
        } else {
            nodes.outline?.destroy();
            delete nodes.outline;
        }

        if(settings.flags.bloom) {
            nodes.bloom ??= new BloomNode(this);
        } else {
            nodes.bloom?.destroy();
            delete nodes.bloom;
        }

        if(settings.flags.lens) {
            nodes.lens ??= new LensNode(this);
        } else {
            nodes.lens?.destroy();
            delete nodes.lens;
        }

        if(settings.flags.motionBlur) {
            nodes.motionBlur ??= new MotionBlurNode(this);
        } else {
            nodes.motionBlur?.destroy();
            delete nodes.motionBlur;
        }

        return [nodes.taa, nodes.grid, nodes.outline, nodes.bloom, nodes.lens, nodes.motionBlur].filter(n => n != null);
    }
}

RenderPath.register('standard', StandardRenderPath);
