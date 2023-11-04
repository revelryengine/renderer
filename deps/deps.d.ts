declare module 'https://*'

declare module 'https://cdn.jsdelivr.net/gh/toji/gl-matrix@v3.4.1/src/index.js' {
    import 'vendor/cdn.jsdelivr.net/gh/toji/gl-matrix@v3.4.1/src/types.d.js';
    export * from 'vendor/cdn.jsdelivr.net/gh/toji/gl-matrix@v3.4.1/src/index.js';
}