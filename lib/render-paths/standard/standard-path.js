import { RenderPath } from '../render-path.js';

import { Settings        } from './settings.js';
import { AudioController } from './audio.js';

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


export class StandardRenderPath extends RenderPath {
    static Settings = Settings;
    settings = new Settings(this.gal);

    audio = new AudioController();

    reconfigureNodes() {
        const { settings, nodes, preNodes } = this;

        nodes.main   ??= new MainNode(this);
        nodes.output ??= new OutputNode(this);

        if(settings.enabled.passiveInput || settings.enabled.transmission || settings.enabled.ssao) {
            nodes.base ??= new BaseNode(this);
        } else {
            nodes.base = nodes.base?.destroy();
        }

        if(settings.enabled.transmission) {
            this.connect(nodes.base, nodes.main, { color: 'transmission' });
        } else {
            this.disconnect(nodes.main, ['transmission']);
        }

        if(settings.enabled.ssao) {
            nodes.ssao ??= new SSAONode(this);
            this.connect(nodes.base, nodes.ssao, { point: 'point' });
            this.connect(nodes.ssao, nodes.main, { color: 'ssao' });
        } else {
            nodes.ssao = nodes.ssao?.destroy();

            this.disconnect(nodes.ssao, ['point']);
            this.disconnect(nodes.main, ['ssao']);
        }


        const envConnections = { environment: 'environment', envGGX: 'envGGX', envCharlie: 'envCharlie', envLUT: 'envLUT' };
        if(settings.enabled.environment) {
            preNodes.environment ??= new EnvironmentNode(this);

            this.connect(preNodes.environment, nodes.main, envConnections);
            this.connect(preNodes.environment, nodes.base, envConnections);
        } else {
            preNodes.environment = preNodes.environment?.destroy();

            this.disconnect(nodes.main, Object.values(envConnections));
            this.disconnect(nodes.base, Object.values(envConnections));
        }

        const punConnections = { punctual: 'punctual', depth: 'shadows', shadowsSampler: 'shadowsSampler' };
        if(settings.enabled.punctual) {
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

        if(settings.enabled.audio) {
            preNodes.audio ??= new AudioNode(this);
            this.connect(preNodes.audio, nodes.output, { audio: 'audio' });
        } else {
            preNodes.audio = preNodes.audio?.destroy();
        }
    }

    reconfigurePostNodes() {
        const { settings, nodes } = this;

        if(settings.enabled.lens) {
            nodes.lens ??= new LensNode(this);
        } else {
            nodes.lens = nodes.lens?.destroy();
        }

        if(settings.enabled.grid) {
            nodes.grid ??= new GridNode(this);
        } else {
            nodes.grid = nodes.grid?.destroy();
        }

        if(settings.enabled.bloom) {
            nodes.bloom ??= new BloomNode(this);
        } else {
            nodes.bloom = nodes.bloom?.destroy();
        }

        if(settings.enabled.motionBlur) {
            nodes.motionBlur ??= new MotionBlurNode(this);
        } else {
            nodes.motionBlur = nodes.motionBlur?.destroy();
        }

        if(settings.enabled.taa) {
            nodes.taa ??= new TAANode(this);
        } else {
            nodes.taa = nodes.taa?.destroy();
        }

        if(settings.enabled.outline) {
            nodes.outline ??= new OutlineNode(this);
        } else {
            nodes.outline ??= nodes.outline?.destroy();
        }

        return [nodes.taa, nodes.lens, nodes.grid, nodes.bloom, nodes.motionBlur, nodes.outline];
    }
}

RenderPath.define('standard', StandardRenderPath);
