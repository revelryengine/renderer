import { WebGLTF    } from '../webgltf.js';
import { mat4, mat3 } from '../utils/gl-matrix.js';
import { UBO        } from './ubo.js';

const ROTATIONS = {
    '+Z': 90.0,
    '-X': 180,
    '-Z': 270,
    '+X': 0.0,
}
const GL = WebGL2RenderingContext;

export class EnvironmentUBO extends UBO {
    static location = 1;
    
    static layout = new UBO.Layout([
        { name: 'u_Exposure',    type: GL.FLOAT      }, //  0 +  4 =  4
        { name: 'u_MipCount',    type: GL.INT        }, //  4 +  4 =  8
        { name: 'u_EnvRotation', type: GL.FLOAT_MAT3 }, // 16 + 48 = 64
        { name: 'u_FogColor',    type: GL.FLOAT_VEC4 }, // 64 + 16 = 80 
        { name: 'u_FogRange',    type: GL.FLOAT_VEC2 }, // 80 +  8 = 88
    ]);
}

/**
* An environment is a specifically structured glTF asset that contains the neccessary images and textures to create an IBL environment.
*/
export class Environment extends WebGLTF {
    #cache = new WeakMap();

    async load(...args) {
        await super.load(...args);
        
        this.lutTexture        = this.textures.find(texture => texture.name === 'lut');
        this.lutSheenETexture  = this.textures.find(texture => texture.name === 'lutSheenE');
        this.lutCharlieTexture = this.textures.find(texture => texture.name === 'lutCharlie');
        
        this.envGGXTexture        = this.textures.find(texture => texture.name === 'envGGX');
        this.envLambertianTexture = this.textures.find(texture => texture.name === 'envLambertian');
        this.envCharlieTexture    = this.textures.find(texture => texture.name === 'envCharlie');
        
        
        return this;
    }
    
    createTextures(context) {
        if(this.#cache.get(context)) return;
        
        this.lutTexture.createWebGLTexture(context);
        this.lutSheenETexture.createWebGLTexture(context);
        this.lutCharlieTexture.createWebGLTexture(context);
        this.envGGXTexture.createWebGLTexture(context, context.TEXTURE_CUBE_MAP);
        this.envLambertianTexture.createWebGLTexture(context, context.TEXTURE_CUBE_MAP);
        this.envCharlieTexture.createWebGLTexture(context, context.TEXTURE_CUBE_MAP);
        
        this.mipCount = this.extras?.mipCount || 0;
        this.rotation = mat3.create();
        
        this.rotationMat4 = mat4.create();
        mat4.fromYRotation(this.rotationMat4, ROTATIONS[this.extras.rotation] / 180.0 * Math.PI);
        mat3.fromMat4(this.rotation, this.rotationMat4);
        
        this.#cache.set(context, true);
    }
}

export default Environment;
