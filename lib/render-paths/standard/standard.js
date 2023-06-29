import { RenderPath } from '../render-path.js';

import { Settings        } from './settings.js';
import { AudioController } from './audio.js';

import { PostNode   } from '../common/nodes/post-node.js';
import { OutputNode } from '../common/nodes/output-node.js';
import { GridNode   } from '../common/nodes/grid-node.js';
import { TAANode    } from '../common/nodes/taa-node.js';

import { AudioNode       } from './nodes/audio-node.js';
import { EnvironmentNode } from './nodes/environment-node.js';
import { PunctualNode    } from './nodes/punctual-node.js';
import { BaseNode        } from './nodes/base-node.js';
import { MainNode        } from './nodes/main-node.js';
import { LensNode        } from './nodes/lens-node.js';
import { SSAONode        } from './nodes/ssao-node.js';
import { BloomNode       } from './nodes/bloom-node.js';
import { MotionBlurNode  } from './nodes/motion-blur-node.js';


export class StandardRenderPath extends RenderPath {
    static Settings = Settings;

    audio = new AudioController();

    reconfigureNodes() {
        const { settings, nodes, preNodes } = this;

        nodes.main   ??= new MainNode(this);
        nodes.output ??= new OutputNode(this);

        if(settings.ssao.enabled) {
            nodes.ssao ??= new SSAONode(this);

            this.connect(nodes.ssao, nodes.main, { color: 'ssao' });
        } else {
            nodes.ssao = nodes.ssao?.destroy();

            this.disconnect(nodes.main, ['ssao']);
        }

        if(settings.passiveInput.enabled || settings.transmission.enabled || settings.ssao.enabled) {
            nodes.base ??= new BaseNode(this);
        } else {
            nodes.base = nodes.base?.destroy();
        }

        if(settings.transmission.enabled) {
            this.connect(nodes.base, nodes.main, { color: 'transmission' });
        } else {
            this.disconnect(nodes.main, ['transmission']);
        }

        if(settings.ssao.enabled) {
            this.connect(nodes.base, nodes.ssao, { point: 'point' });
        } else {
            this.disconnect(nodes.ssao, ['point']);
        }

        const envConnections = { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT' };
        if(settings.environment.enabled) {
            preNodes.environment ??= new EnvironmentNode(this);

            this.connect(preNodes.environment, nodes.main, envConnections);
            this.connect(preNodes.environment, nodes.base, envConnections);
        } else {
            preNodes.environment = preNodes.environment?.destroy();

            this.disconnect(nodes.main, Object.values(envConnections));
            this.disconnect(nodes.base, Object.values(envConnections));
        }

        const punConnections = { punctual: 'punctual', depth: 'shadows', shadowsSampler: 'shadowsSampler' };
        if(settings.punctual.enabled) {
            preNodes.punctual ??= new PunctualNode(this);

            this.connect(preNodes.punctual, nodes.main, punConnections);
            this.connect(preNodes.punctual, nodes.base, punConnections);
        } else {
            preNodes.punctual = preNodes.punctual?.destroy();

            this.disconnect(nodes.main, Object.values(punConnections));
            this.disconnect(nodes.base, Object.values(punConnections));
        }

        nodes.post = new PostNode(this, this.reconfigurePostNodes().filter(n => n));
        this.connect(nodes.main, nodes.post,   { color: 'color', depth: 'depth', motion: 'motion' });
        this.connect(nodes.post, nodes.output, { color: 'color' });

        if(settings.audio.enabled) {
            preNodes.audio ??= new AudioNode(this);
            this.connect(preNodes.audio, nodes.output, { audio: 'audio' });
        } else {
            preNodes.audio = preNodes.audio?.destroy();
        }
    }

    reconfigurePostNodes() {
        const { settings, nodes } = this;

        if(settings.lens.enabled) {
            nodes.lens ??= new LensNode(this);
        } else {
            nodes.lens = nodes.lens?.destroy();
        }

        if(settings.grid.enabled) {
            nodes.grid ??= new GridNode(this);
        } else {
            nodes.grid = nodes.grid?.destroy();
        }

        if(settings.bloom.enabled) {
            nodes.bloom ??= new BloomNode(this);
        } else {
            nodes.bloom = nodes.bloom?.destroy();
        }

        if(settings.motionBlur.enabled) {
            nodes.motionBlur ??= new MotionBlurNode(this);
        } else {
            nodes.motionBlur = nodes.motionBlur?.destroy();
        }

        if(settings.taa.enabled) {
            nodes.taa ??= new TAANode(this);
        } else {
            nodes.taa = nodes.taa?.destroy();
        }

        return [nodes.taa, nodes.lens, nodes.grid, nodes.bloom, nodes.motionBlur];
    }
}

RenderPath.define('standard', StandardRenderPath);