import UBO from '../ubo.js';

export class RenderPath {
    static Settings = UBO;

    nodes    = {};
    path     = [];
    preNodes = {};
    prePath  = [];
    
    constructor(renderer) {
        this.renderer = renderer;
        this.settings = new this.constructor.Settings(this.gal);
    }

    get gal() {
        return this.renderer.gal;
    }

    get width() {
        return this.renderer.width;
    }

    get height() {
        return this.renderer.height;
    }

    reconfigure(settings) {
        if(settings) this.settings.update(settings);
        
        this.reconfigureNodes();
        this.calculateNodePath();

        for(const node of [...this.prePath, ...this.path]) {
            node.reconfigure();
        }
    }

    reconfigureNodes() {

    }

    connect(src, dst, connections) {
        if(!dst) return;
        for(const [output, input] of Object.entries(connections)) {
            dst.connections[input] = { src, output };
        }
    }
    
    disconnect(dst, connections) {
        if(dst?.connections) {
            for(const name of connections) {
                delete dst.connections[name];
            }
        }
    }

    /**
     * Calculates the order of the nodes by working backwards from the output connections
     */
    calculateNodePath() {
        this.path.length    = 0;
        this.prePath.length = 0;

        const search = [this.nodes.output];
            
        while(search.length) {
            const node = search.pop();
            if(Object.values(this.preNodes).indexOf(node) === -1) {
                this.path.unshift(node);
            } else {
                this.prePath.unshift(node);
            }
            search.push(...Object.values(node.connections).map(({ src }) => src));
        }

        //Remove duplicates
        this.path    = [...new Set(this.path)]; 
        this.prePath = [...new Set(this.prePath)]; 
    }

    get output () {
        return this.nodes.output?.output;
    }

    static registry = new Map();
    static define(name, Constructor) {
        this.registry.set(name, Constructor);
    }
}

export default RenderPath;