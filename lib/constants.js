/**
 * @see https://www.w3.org/TR/webgpu
 */


export const GL = WebGL2RenderingContext;

export const BUFFER_USAGE = self.GPUBufferUsage || { 
    MAP_READ      : 0x0001,
    MAP_WRITE     : 0x0002,
    COPY_SRC      : 0x0004,
    COPY_DST      : 0x0008,
    INDEX         : 0x0010,
    VERTEX        : 0x0020,
    UNIFORM       : 0x0040,
    STORAGE       : 0x0080,
    INDIRECT      : 0x0100,
    QUERY_RESOLVE : 0x0200,
};

export const TEXTURE_USAGE = self.GPUTextureUsage  || {
    COPY_SRC          : 0x01,
    COPY_DST          : 0x02,
    TEXTURE_BINDING   : 0x04,
    STORAGE_BINDING   : 0x08,
    RENDER_ATTACHMENT : 0x10,
};

export const MAP_MODE = self.GPUMapMode || {
    READ  : 0x0001,
    WRITE : 0x0002,
};


export const SHADER_STAGE = self.GPUShaderStage || {
    VERTEX   : 0x1,
    FRAGMENT : 0x2,
    COMPUTE  : 0x4,
};

export const COLOR_WRITE = self.GPUColorWrite || {
    RED   : 0x1,
    GREEN : 0x2,
    BLUE  : 0x4,
    ALPHA : 0x8,
    ALL   : 0xF,
};

//map between gltf gl constants and webgpu for buffer views
export const BUFFERVIEW_USAGE = {
    [GL.ARRAY_BUFFER]:         BUFFER_USAGE.VERTEX,
    [GL.ELEMENT_ARRAY_BUFFER]: BUFFER_USAGE.INDEX,
};

export const BUFFER_USAGE_TARGETS = {
    [BUFFER_USAGE.VERTEX]  : GL.ARRAY_BUFFER,
    [BUFFER_USAGE.INDEX]   : GL.ELEMENT_ARRAY_BUFFER,
    [BUFFER_USAGE.UNIFORM] : GL.UNIFORM_BUFFER,
}


/** 
 * @see https://www.khronos.org/registry/OpenGL/extensions/ARB/ARB_uniform_buffer_object.txt
 * @see https://learnopengl.com/Advanced-OpenGL/Advanced-GLSL
 * @see https://www.w3.org/TR/WGSL/#types
 * @see https://www.w3.org/TR/WGSL/#memory-layouts
 * */
export const STD140_LAYOUT = {
    'bool':         { align:   4, size:   4, TypedArray: Uint8Array,   glsl: 'bool'   }, 
    'i32':          { align:   4, size:   4, TypedArray: Int32Array,   glsl: 'int'    }, 
    'u32':          { align:   4, size:   4, TypedArray: Uint32Array,  glsl: 'uint'   }, 
    'f32':          { align:   4, size:   4, TypedArray: Float32Array, glsl: 'float'  },
    'vec2<bool>':   { align:   8, size:   8, TypedArray: Uint8Array,   glsl: 'bvec2'  },
    'vec2<i32>':    { align:   8, size:   8, TypedArray: Int32Array,   glsl: 'ivec2'  },
    'vec2<u32>':    { align:   8, size:   8, TypedArray: Uint32Array,  glsl: 'uvec2'  },
    'vec2<f32>':    { align:   8, size:   8, TypedArray: Float32Array, glsl: 'vec2'   },
    'vec3<bool>':   { align:  16, size:  12, TypedArray: Uint8Array,   glsl: 'bvec3'  },
    'vec3<i32>':    { align:  16, size:  12, TypedArray: Int32Array,   glsl: 'ivec3'  },
    'vec3<u32>':    { align:  16, size:  12, TypedArray: Uint32Array,  glsl: 'uvec3'  },
    'vec3<f32>':    { align:  16, size:  12, TypedArray: Float32Array, glsl: 'vec3'   },
    'vec4<bool>':   { align:  16, size:  16, TypedArray: Uint8Array,   glsl: 'bvec4'  },
    'vec4<i32>':    { align:  16, size:  16, TypedArray: Int32Array,   glsl: 'ivec4'  },
    'vec4<u32>':    { align:  16, size:  16, TypedArray: Uint32Array,  glsl: 'uvec4'  },
    'vec4<f32>':    { align:  16, size:  16, TypedArray: Float32Array, glsl: 'vec4'   },
    'mat2x2<f32>':  { align:  16, size:  32, TypedArray: Float32Array, glsl: 'mat2'   },
    'mat2x3<f32>':  { align:  16, size:  48, TypedArray: Float32Array, glsl: 'mat2x3' },
    'mat2x4<f32>':  { align:  16, size:  64, TypedArray: Float32Array, glsl: 'mat2x4' },
    'mat3x2<f32>':  { align:  16, size:  32, TypedArray: Float32Array, glsl: 'mat3x2' },
    'mat3x3<f32>':  { align:  16, size:  48, TypedArray: Float32Array, glsl: 'mat3'   },
    'mat3x4<f32>':  { align:  16, size:  64, TypedArray: Float32Array, glsl: 'mat3x4' },
    'mat4x2<f32>':  { align:  16, size:  32, TypedArray: Float32Array, glsl: 'mat4x2' },
    'mat4x3<f32>':  { align:  16, size:  48, TypedArray: Float32Array, glsl: 'mat4x3' },
    'mat4x4<f32>':  { align:  16, size:  64, TypedArray: Float32Array, glsl: 'mat4'   },
}

export const PRIMITIVE_MODES = {
    [GL.POINTS]:         'point-list',
    [GL.TRIANGLES]:       'triangle-list',
    [GL.TRIANGLE_STRIP]: 'triangle-strip',
    [GL.LINES]:          'line-list',
    [GL.LINE_STRIP]:     'line-strip',

    'point-list':        GL.POINTS,
    'triangle-list':     GL.TRIANGLES,
    'triangle-strip':    GL.TRIANGLE_STRIP,
    'line-list':         GL.LINES,
    'line-strip':        GL.LINE_STRIP,
}

// ASTC format, from:
// https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_astc/
const COMPRESSED_RGBA_ASTC_4X4_KHR = 0x93B0;
const COMPRESSED_SRGB8_ALPHA8_ASTC_4X4_KHR = 0x93D0;

// BC7 format, from:
// https://www.khronos.org/registry/webgl/extensions/EXT_texture_compression_bptc/
const COMPRESSED_RGBA_BPTC_UNORM = 0x8E8C;
const COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT = 0x8E8D;

// ETC format, from:
// https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_etc/
const COMPRESSED_RGBA8_ETC2_EAC = 0x9278;
const COMPRESSED_SRGB8_ALPHA8_ETC2_EAC = 0x9279;


export const TEXTURE_FORMAT = {
    // 8-bit formats
    'r8unorm'         : { bytes:  1, webgl2: { internal: GL.R8,             format: GL.RED        , type: GL.UNSIGNED_BYTE   } },
    'r8snorm'         : { bytes:  1, webgl2: { internal: GL.R8_SNORM,       format: GL.RED        , type: GL.BYTE            } },
    'r8uint'          : { bytes:  1, webgl2: { internal: GL.R8UI,           format: GL.RED_INTEGER, type: GL.UNSIGNED_BYTE   } },
    'r8sint'          : { bytes:  1, webgl2: { internal: GL.R8I,            format: GL.RED_INTEGER, type: GL.BYTE            } },

    // 16-bit formats
    'r16uint'         : { bytes:  2, webgl2: { internal: GL.R16UI,          format: GL.RED_INTEGER, type: GL.UNSIGNED_SHORT  } },
    'r16sint'         : { bytes:  2, webgl2: { internal: GL.R16I,           format: GL.RED_INTEGER, type: GL.SHORT           } },
    'r16float'        : { bytes:  2, webgl2: { internal: GL.R16F,           format: GL.RED        , type: GL.HALF_FLOAT      } },
    'rg8unorm'        : { bytes:  2, webgl2: { internal: GL.RG8,            format: GL.RG         , type: GL.UNSIGNED_BYTE   } },
    'rg8snorm'        : { bytes:  2, webgl2: { internal: GL.RG8_SNORM,      format: GL.RG         , type: GL.BYTE            } },
    'rg8uint'         : { bytes:  2, webgl2: { internal: GL.RG8UI,          format: GL.RG_INTEGER , type: GL.UNSIGNED_BYTE   } },
    'rg8sint'         : { bytes:  2, webgl2: { internal: GL.RG8I,           format: GL.RG_INTEGER , type: GL.BYTE            } },

    // 32-bit formats
    'r32uint'         : { bytes:  4, webgl2: { internal: GL.R32UI,          format: GL.RED_INTEGER,  type: GL.UNSIGNED_INT   } },
    'r32sint'         : { bytes:  4, webgl2: { internal: GL.R32I,           format: GL.RED_INTEGER,  type: GL.INT            } },
    'r32float'        : { bytes:  4, webgl2: { internal: GL.R32F,           format: GL.RED,          type: GL.FLOAT          } },
    'rg16uint'        : { bytes:  4, webgl2: { internal: GL.RG16UI,         format: GL.RG_INTEGER,   type: GL.UNSIGNED_SHORT } },
    'rg16sint'        : { bytes:  4, webgl2: { internal: GL.RG16I,          format: GL.RG_INTEGER,   type: GL.SHORT          } },
    'rg16float'       : { bytes:  4, webgl2: { internal: GL.RG16F,          format: GL.RG,           type: GL.HALF_FLOAT     } },
    'rgba8unorm'      : { bytes:  4, webgl2: { internal: GL.RGBA8,          format: GL.RGBA,         type: GL.UNSIGNED_BYTE  } },
    'rgba8unorm-srgb' : { bytes:  4, webgl2: { internal: GL.SRGB8_ALPHA8,   format: GL.RGBA,         type: GL.UNSIGNED_BYTE  } },
    'rgba8snorm'      : { bytes:  4, webgl2: { internal: GL.RGBA8_SNORM,    format: GL.RGBA,         type: GL.BYTE           } },
    'rgba8uint'       : { bytes:  4, webgl2: { internal: GL.RGBA8UI,        format: GL.RGBA_INTEGER, type: GL.UNSIGNED_BYTE  } },
    'rgba8sint'       : { bytes:  4, webgl2: { internal: GL.RGBA8I,         format: GL.RGBA_INTEGER, type: GL.BYTE           } },
    'bgra8unorm'      : { bytes:  4, webgl2: { internal: null, format: null, type: null } },
    'bgra8unorm-srgb' : { bytes:  4, webgl2: { internal: null, format: null, type: null } },

    // Packed 32-bit formats
    'rgb9e5ufloat'    : { bytes:  4, webgl2: { internal: GL.RGB9_E5,        format: GL.RGB,          type: GL.FLOAT                        } },
    'rgb10a2unorm'    : { bytes:  4, webgl2: { internal: GL.RGB10_A2,       format: GL.RGBA,         type: GL.UNSIGNED_INT_2_10_10_10_REV  } },
    'rg11b10ufloat'   : { bytes:  4, webgl2: { internal: GL.R11F_G11F_B10F, format: GL.RGB,          type: GL.UNSIGNED_INT_10F_11F_11F_REV } },

    // 64-bit formats
    'rg32uint'        : { bytes:  8, webgl2: { internal: GL.RG32UI,         format: GL.RG_INTEGER,   type: GL.UNSIGNED_INT                 } },
    'rg32sint'        : { bytes:  8, webgl2: { internal: GL.RG32I,          format: GL.RG_INTEGER,   type: GL.INT                          } },
    'rg32float'       : { bytes:  8, webgl2: { internal: GL.RG32F,          format: GL.RG,           type: GL.FLOAT                        } },
    'rgba16uint'      : { bytes:  8, webgl2: { internal: GL.RGBA16UI,       format: GL.RGBA_INTEGER, type: GL.UNSIGNED_SHORT               } },
    'rgba16sint'      : { bytes:  8, webgl2: { internal: GL.RGBA16I,        format: GL.RGBA_INTEGER, type: GL.SHORT                        } },
    'rgba16float'     : { bytes:  8, webgl2: { internal: GL.RGBA16F,        format: GL.RGBA,         type: GL.HALF_FLOAT                   } },

    // 128-bit formats
    'rgba32uint'      : { bytes: 16, webgl2: { internal: GL.RGBA32UI,       format: GL.RGBA_INTEGER, type: GL.UNSIGNED_INT                 } },
    'rgba32sint'      : { bytes: 16, webgl2: { internal: GL.RGBA32I,        format: GL.RGBA_INTEGER, type: GL.INT                          } },
    'rgba32float'     : { bytes: 16, webgl2: { internal: GL.RGBA32F,        format: GL.RGBA,         type: GL.FLOAT                        } },

    // Depth and stencil formats
    'stencil8':             { bytes:  2, webgl2: { internal: GL.DEPTH_COMPONENT16,  format: GL.DEPTH_COMPONENT, type: GL.UNSIGNED_SHORT    } },
    'depth16unorm':         { bytes:  2, webgl2: { internal: GL.DEPTH_COMPONENT16,  format: GL.DEPTH_COMPONENT, type: GL.UNSIGNED_SHORT    } },
    'depth24plus':          { bytes:  4, webgl2: { internal: GL.DEPTH_COMPONENT24,  format: GL.DEPTH_COMPONENT, type: GL.UNSIGNED_INT      } },
    "depth24plus-stencil8": { bytes:  4, webgl2: { internal: GL.DEPTH24_STENCIL8,   format: GL.DEPTH_STENCIL,   type: GL.UNSIGNED_INT_24_8 } },
    'depth32float':         { bytes:  4, webgl2: { internal: GL.DEPTH_COMPONENT32F, format: GL.DEPTH_COMPONENT, type: GL.FLOAT             } },

    // "depth24unorm-stencil8" feature
    'depth24unorm-stencil8': { bytes:  4, webgl2: { internal: GL.DEPTH24_STENCIL8, format: GL.DEPTH_STENCIL, type: GL.UNSIGNED_INT_24_8    } },

    // "depth32float-stencil8" feature
    'depth32float-stencil8': { bytes:  8, webgl2: { internal: GL.DEPTH32F_STENCIL8, format: GL.DEPTH_STENCIL, type: GL.FLOAT_32_UNSIGNED_INT_24_8_REV } },

    'astc-4x4-unorm':        { bytes: 4, webgl2: { internal: COMPRESSED_RGBA_ASTC_4X4_KHR,         format: COMPRESSED_RGBA_ASTC_4X4_KHR,         type: GL.UNSIGNED_BYTE, compressed: true } },
    'astc-4x4-unorm-srgb':   { bytes: 4, webgl2: { internal: COMPRESSED_SRGB8_ALPHA8_ASTC_4X4_KHR, format: COMPRESSED_SRGB8_ALPHA8_ASTC_4X4_KHR, type: GL.UNSIGNED_BYTE, compressed: true } },
    'bc7-rgba-unorm':        { bytes: 4, webgl2: { internal: COMPRESSED_RGBA_BPTC_UNORM,           format: COMPRESSED_RGBA_BPTC_UNORM,           type: GL.UNSIGNED_BYTE, compressed: true } },
    'bc7-rgba-unorm-srgb':   { bytes: 4, webgl2: { internal: COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT, format: COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT, type: GL.UNSIGNED_BYTE, compressed: true } },
    'etc2-rgb8a1unorm':      { bytes: 4, webgl2: { internal: COMPRESSED_RGBA8_ETC2_EAC,            format: COMPRESSED_RGBA8_ETC2_EAC,            type: GL.UNSIGNED_BYTE, compressed: true } },
    'etc2-rgb8a1unorm-srgb': { bytes: 4, webgl2: { internal: COMPRESSED_SRGB8_ALPHA8_ETC2_EAC,     format: COMPRESSED_SRGB8_ALPHA8_ETC2_EAC,     type: GL.UNSIGNED_BYTE, compressed: true } },
}

export const FRAMEUBUFFER_STATUS_ERRORS = {
    [GL.FRAMEBUFFER_UNSUPPORTED]:                   'FRAMEBUFFER_UNSUPPORTED',
    [GL.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]:         'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
    [GL.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
    [GL.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]:        'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE',
}

const NORMALIZED = true;
export const VERTEX_FORMAT = {
    'uint8x2':   { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_BYTE,  size: 2 } },
    'uint8x4':   { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_BYTE,  size: 4 } },
    'sint8x2':   { webgl2: { normalized: false, integer: true,  type: GL.BYTE,           size: 2 } },
    'sint8x4':   { webgl2: { normalized: false, integer: true,  type: GL.BYTE,           size: 4 } },
    'unorm8x2':  { webgl2: { normalized: true,  integer: false, type: GL.UNSIGNED_BYTE,  size: 2 } },
    'unorm8x4':  { webgl2: { normalized: true,  integer: false, type: GL.UNSIGNED_BYTE,  size: 4 } },
    'snorm8x2':  { webgl2: { normalized: true,  integer: false, type: GL.BYTE,           size: 2 } },
    'snorm8x4':  { webgl2: { normalized: true,  integer: false, type: GL.BYTE,           size: 4 } },
    'uint16':    { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_SHORT, size: 1 } },
    'uint16x2':  { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_SHORT, size: 2 } },
    'uint16x4':  { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_SHORT, size: 4 } },
    'sint16x2':  { webgl2: { normalized: false, integer: true,  type: GL.SHORT,          size: 2 } },
    'sint16x4':  { webgl2: { normalized: false, integer: true,  type: GL.SHORT,          size: 4 } },
    'unorm16x2': { webgl2: { normalized: true,  integer: false, type: GL.UNSIGNED_SHORT, size: 2 } },
    'unorm16x4': { webgl2: { normalized: true,  integer: false, type: GL.UNSIGNED_SHORT, size: 4 } },
    'snorm16x2': { webgl2: { normalized: true,  integer: false, type: GL.SHORT,          size: 2 } },
    'snorm16x4': { webgl2: { normalized: true,  integer: false, type: GL.SHORT,          size: 4 } },
    'float16x2': { webgl2: { normalized: false, integer: false, type: GL.HALF_FLOAT,     size: 2 } },
    'float16x4': { webgl2: { normalized: false, integer: false, type: GL.HALF_FLOAT,     size: 4 } },
    'float32':   { webgl2: { normalized: false, integer: false, type: GL.FLOAT,          size: 1 } },
    'float32x2': { webgl2: { normalized: false, integer: false, type: GL.FLOAT,          size: 2 } },
    'float32x3': { webgl2: { normalized: false, integer: false, type: GL.FLOAT,          size: 3 } },
    'float32x4': { webgl2: { normalized: false, integer: false, type: GL.FLOAT,          size: 4 } },
    'uint32':    { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_INT,   size: 1 } },
    'uint32x2':  { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_INT,   size: 2 } },
    'uint32x3':  { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_INT,   size: 3 } },
    'uint32x4':  { webgl2: { normalized: false, integer: true,  type: GL.UNSIGNED_INT,   size: 4 } },
    'sint32':    { webgl2: { normalized: false, integer: true,  type: GL.INT,            size: 1 } },
    'sint32x2':  { webgl2: { normalized: false, integer: true,  type: GL.INT,            size: 2 } },
    'sint32x3':  { webgl2: { normalized: false, integer: true,  type: GL.INT,            size: 3 } },
    'sint32x4':  { webgl2: { normalized: false, integer: true,  type: GL.INT,            size: 4 } },

    gltf: {
        [!NORMALIZED]: {
            [GL.BYTE]           : 'sint8',
            [GL.UNSIGNED_BYTE]  : 'uint8',
            [GL.SHORT]          : 'sint16',
            [GL.UNSIGNED_SHORT] : 'uint16',
            [GL.UNSIGNED_INT]   : 'uint32',
            [GL.FLOAT]          : 'float32',
        },
        [NORMALIZED]: {
            [GL.BYTE]           : 'snorm8',
            [GL.UNSIGNED_BYTE]  : 'unorm8',
            [GL.SHORT]          : 'snorm16',
            [GL.UNSIGNED_SHORT] : 'unorm16',
            [GL.FLOAT]          : 'float32',
        },
    }
}  

export const SAMPLER_PARAM = {
    'clamp-to-edge'      : GL.CLAMP_TO_EDGE,
    'repeat'             : GL.REPEAT,
    'mirror-repeat'      : GL.MIRRORED_REPEAT,

    'linear'             : GL.LINEAR,
    'nearest'            : GL.NEAREST,
    mipmap: {
        'linear':  {
            'linear'  : GL.LINEAR_MIPMAP_LINEAR,
            'nearest' : GL.LINEAR_MIPMAP_NEAREST,
        },
        'nearest': {
            'linear'  : GL.NEAREST_MIPMAP_LINEAR,
            'nearest' : GL.NEAREST_MIPMAP_NEAREST,
        },
    },

    [GL.REPEAT]          : 'repeat',
    [GL.CLAMP_TO_EDGE]   : 'clamp-to-edge',
    [GL.MIRRORED_REPEAT] : 'mirror-repeat',
    
    [GL.LINEAR]                 : { filter: 'linear'                      },
    [GL.NEAREST]                : { filter: 'nearest'                     },
    [GL.LINEAR_MIPMAP_LINEAR]   : { filter: 'linear',  mipmap: 'linear'  },
    [GL.LINEAR_MIPMAP_NEAREST]  : { filter: 'linear',  mipmap: 'nearest' },
    [GL.NEAREST_MIPMAP_LINEAR]  : { filter: 'nearest', mipmap: 'linear'  },
    [GL.NEAREST_MIPMAP_NEAREST] : { filter: 'nearest', mipmap: 'nearest' },
}

export const MIPMAP_FILTERS = new Set([
    GL.NEAREST_MIPMAP_NEAREST,
    GL.NEAREST_MIPMAP_LINEAR,
    GL.LINEAR_MIPMAP_NEAREST,
    GL.LINEAR_MIPMAP_LINEAR,
]);

export const COMPARE_FUNC = {
    'never'         : GL.NEVER,
    'less'          : GL.LESS,
    'less-equal'    : GL.LEQUAL,
    'greater'       : GL.GREATER,
    'not-equal'     : GL.NOTEQUAL,
    'greater-equal' : GL.GEQUAL,
    'always'        : GL.ALWAYS,
}

export const CULL_MODE = {
    'front' : GL.FRONT,
    'back'  : GL.BACK,
}

export const BLEND_FACTOR = {
    'zero'                : GL.ZERO,
    'one'                 : GL.ONE,
    'src'                 : GL.SRC_COLOR,
    'one-minus-src'       : GL.ONE_MINUS_SRC_COLOR,
    'src-alpha'           : GL.SRC_ALPHA,
    'one-minus-src-alpha' : GL.ONE_MINUS_SRC_ALPHA,
    'dst'                 : GL.DST_COLOR,
    'one-minus-dst'       : GL.ONE_MINUS_DST_COLOR,
    'dst-alpha'           : GL.DST_ALPHA,
    'one-minus-dst-alpha' : GL.ONE_MINUS_DST_ALPHA,
    'src-alpha-saturated' : GL.SRC_ALPHA_SATURATE,
    'constant'            : GL.CONSTANT_COLOR,
    'one-minus-constant'  : GL.ONE_MINUS_CONSTANT_COLOR,

    [GL.ZERO]                     : 'zero'                ,
    [GL.ONE]                      : 'one'                 ,
    [GL.SRC_COLOR]                : 'src'                 ,
    [GL.ONE_MINUS_SRC_COLOR]      : 'one-minus-src'       ,
    [GL.SRC_ALPHA]                : 'src-alpha'           ,
    [GL.ONE_MINUS_SRC_ALPHA]      : 'one-minus-src-alpha' ,
    [GL.DST_COLOR]                : 'dst'                 ,
    [GL.ONE_MINUS_DST_COLOR]      : 'one-minus-dst'       ,
    [GL.DST_ALPHA]                : 'dst-alpha'           ,
    [GL.ONE_MINUS_DST_ALPHA]      : 'one-minus-dst-alpha' ,
    [GL.SRC_ALPHA_SATURATE]       : 'src-alpha-saturated' ,
    [GL.CONSTANT_COLOR]           : 'constant'            ,
    [GL.ONE_MINUS_CONSTANT_COLOR] : 'one-minus-constant'  ,
}

export const BLEND_OPERATION = {
    'add'              : GL.FUNC_ADD,
    'subtract'         : GL.FUNC_SUBTRACT,
    'reverse-subtract' : GL.FUNC_REVERSE_SUBTRACT,
    'min'              : GL.MIN,
    'max'              : GL.MAX,

    [GL.FUNC_ADD]              : 'add'              ,
    [GL.FUNC_SUBTRACT]         : 'subtract'         ,
    [GL.FUNC_REVERSE_SUBTRACT] : 'reverse-subtract' ,
    [GL.MIN]                   : 'min'              ,
    [GL.MAX]                   : 'max'              ,
}

export const LIGHT_TYPES = {
    directional : 0,
    point       : 1,
    spot        : 2,
};

export const VK_FORMAT = {
    R8G8B8_SRGB             :   29,
    R8G8B8_UNORM            :   23,
    R16G16B16_SFLOAT        :   90,
    R16G16B16_UNORM         :   84,
    E5B9G9R9_UFLOAT_PACK32  :  123,
    B10G11R11_UFLOAT_PACK32 :  122,
}

/**
 * WebGPU doesn't support 3 component color formats so unpacked formats will need to be converted at runtime
 * @see https://github.com/gpuweb/gpuweb/issues/66
 **/ 
export const VK_FORMAT_ENVIRONMENT = {
    [VK_FORMAT.R8G8B8_SRGB]             : { format: 'rgba8unorm-srgb', pad: true, TypedArray: Uint8Array  },
    [VK_FORMAT.R8G8B8_UNORM]            : { format: 'rgba8unorm',      pad: true, TypedArray: Uint8Array  },
    [VK_FORMAT.R16G16B16_SFLOAT]        : { format: 'rgba16float',     pad: true, TypedArray: Uint16Array  },
    [VK_FORMAT.R16G16B16_UNORM]         : { format: 'rgba16uint',      pad: true, TypedArray: Uint16Array  },

    [VK_FORMAT.E5B9G9R9_UFLOAT_PACK32]  : { format: 'rgb9e5ufloat',    pad: false },
    [VK_FORMAT.B10G11R11_UFLOAT_PACK32] : { format: 'rg11b10ufloat',   pad: false },
}

export const BRDF_DISTRIBUTIONS = {
    'ggx'     : 0,
    'charlie' : 1,
}

export const PBR_DEBUG_MODES = {
    'LightInfo Specular': { 
        wgsl: /* wgsl */`out.color = vec4<f32>(linearTosRGB(lightInfo.specular), 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4(linearTosRGB(lightInfo.specular).rgb, 1.0);`
    },
    'LightInfo Diffuse': { 
        wgsl: /* wgsl */`out.color = vec4<f32>(linearTosRGB(lightInfo.diffuse), 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4(linearTosRGB(lightInfo.diffuse).rgb, 1.0);`
    },
    'LightInfo Irradiance': { 
        wgsl: /* wgsl */`out.color = vec4<f32>(linearTosRGB(lightInfo.irradiance), 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4(linearTosRGB(lightInfo.irradiance).rgb, 1.0);`
    },
    'LightInfo Sheen': { 
        wgsl: /* wgsl */`out.color = vec4<f32>(linearTosRGB(lightInfo.sheen), 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4(linearTosRGB(lightInfo.sheen).rgb, 1.0);`
    },
    'LightInfo Clearcoat': { 
        wgsl: /* wgsl */`out.color = vec4<f32>(linearTosRGB(lightInfo.clearcoat), 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4(linearTosRGB(lightInfo.clearcoat).rgb, 1.0);`
    },
    'LightInfo Occlusion': {
        wgsl: /* wgsl */`out.color = vec4<f32>(vec3<f32>(lightInfo.occlusion), 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4(vec3(lightInfo.occlusion), 1.0);`
    },

    'MaterialInfo Occlusion': {
        wgsl: /* wgsl */`out.color = vec4<f32>(vec3<f32>(materialInfo.occlusion), 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4(vec3(materialInfo.occlusion), 1.0);`
    },
    // 'LightInfo Transmission': { 
    //     wgsl: /* wgsl */`out.color = vec4<f32>(linearTosRGB(lightInfo.transmission), 1.0);`,
    //     glsl: /* glsl */`g_finalColor = vec4(linearTosRGB(lightInfo.transmission).rgb, 1.0);`
    // },
    'NormalInfo World': { 
        wgsl: /* wgsl */`out.color = vec4<f32>((normalInfo.n + 1.0) / 2.0, 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4((normalInfo.n + 1.0) / 2.0, 1.0);`
    },
    'NormalInfo Geometry': { 
        wgsl: /* wgsl */`out.color = vec4<f32>((normalInfo.ng + 1.0) / 2.0, 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4((normalInfo.ng + 1.0) / 2.0, 1.0);`
    },
    'NormalInfo View': { 
        wgsl: /* wgsl */`out.color = vec4<f32>((mat3x3<f32>(frustum.viewMatrix[0].xyz, frustum.viewMatrix[1].xyz, frustum.viewMatrix[2].xyz) * normalInfo.n * 0.5) + 0.5, 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4((mat3(frustum.viewMatrix) * normalInfo.n * 0.5) + 0.5, 1.0);`
    },
    'NormalInfo Tangent': { 
        wgsl: /* wgsl */`out.color = vec4<f32>((normalInfo.t + 1.0) / 2.0, 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4((normalInfo.t + 1.0) / 2.0, 1.0);`
    },
    'NormalInfo Bitangent': { 
        wgsl: /* wgsl */`out.color = vec4<f32>((normalInfo.b + 1.0) / 2.0, 1.0);`,
        glsl: /* glsl */`g_finalColor = vec4((normalInfo.b + 1.0) / 2.0, 1.0);`
    },
    'Lens Focal Distance': { 
        wgsl: /* wgsl */`
            out.color = vec4<f32>(linearTosRGB(lightInfo.specular), 1.0);
            var depth = getLinearDepth(in.gl_FragCoord.z * 0.5 + 0.5);
            if(depth > (settings.lens.focalDistance / 1000.0)) {
                out.color = out.color * vec4<f32>(1.0, 0.0, 0.0, 1.0);
            } else {
                out.color = out.color * vec4<f32>(0.0, 1.0, 0.0, 1.0);
            }
        `,
        glsl: /* glsl */`
            g_finalColor = vec4(linearTosRGB(lightInfo.specular).rgb, 1.0);
            float depth = getLinearDepth(gl_FragCoord.z);
            if(depth > (settings.lens.focalDistance / 1000.0)) {
                g_finalColor = g_finalColor * vec4(1.0, 0.0, 0.0, 1.0);
            } else {
                g_finalColor = g_finalColor * vec4(0.0, 1.0, 0.0, 1.0);
            }
        `
    },
    'Point': {
        wgsl: /* wgsl */`
            out.color = vec4<f32>(in.gl_FragCoord.z, (normalInfo.n * 0.5 + 0.5));
        `,
        glsl: /* glsl */`
            g_finalColor = vec4(gl_FragCoord.z, (normalInfo.n * 0.5 + 0.5));
        `
    }
}