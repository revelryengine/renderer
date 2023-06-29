import { Frustum } from '../../../../../frustum.js';

import generateUniformBlock from '../../../../common/shaders/generators/uniform.glsl.js';
import generateVertexBlock  from '../../../../standard/shaders/generators/gltf/vertex.glsl.js';

import { Settings } from '../../../settings.js';

const settingsUniformBlock = generateUniformBlock(Settings, 0, 0);
const frustumUniformBlock  = generateUniformBlock(Frustum, 1, 0);

export function generate({ flags, locations }) {
    const vertex = generateVertexBlock({ flags, locations });

    const fragment = /* glsl */`#version 300 es
        precision highp float;

        ${settingsUniformBlock}
        ${frustumUniformBlock}
        
        in vec3 v_position;

        in vec4 v_texCoord;

        in vec3 v_barycentric;

        ${flags.colorTargets.motion ? /* glsl */`
        in vec4 v_motionPosition;
        in vec4 v_motionPositionPrev;
        `: ''}

        layout(location=0) out vec4  g_finalColor;
        layout(location=5) out vec2  g_finalMotionVector;

        float edgeFactor(vec3 vbc) {
            vec3 d = fwidth(vbc);
            vec3 f = step(d * settings.wireframe.width, vbc);
            return 1.0 - min(min(f.x, f.y), f.z);
        }

        void main(void) {
            ${flags.colorTargets.motion ? /* glsl */`
                vec2 a = (v_motionPosition.xy / v_motionPosition.w) * 0.5 + 0.5;
                vec2 b = (v_motionPositionPrev.xy / v_motionPositionPrev.w) * 0.5 + 0.5;
                g_finalMotionVector = a - b;
            `: ''}

            ${flags.colorTargets.color ? /* glsl */`
                g_finalColor = settings.wireframe.color;

                if(edgeFactor(v_barycentric) < 1.0) {
                    discard;
                }

                g_finalColor.a *= (1.0 - float(!gl_FrontFacing) * 0.25);
                
            ` : ''}
        }
    `;

    return { vertex, fragment };
}

export default generate;