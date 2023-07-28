type GPUCanvasConfiguration = {
    alphaMode?: 'opaque'|'premultiplied';
    colorSpace?: 'srgb'|'display-p3';
    device?: GPUDevice;
    format?: string;
    usage?: number;
}

export type GPUCanvasContext = {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    configure: (configuration: GPUCanvasConfiguration) => void;
}