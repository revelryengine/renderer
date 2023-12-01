declare namespace Revelry {

    namespace Renderer {

        interface RenderPaths extends Record<string, {
            settings: import('../ubo.js').UBO,
            nodes:     Record<string, import('./render-node.js').RenderNode>,
            preNodes?: Record<string, import('./render-node.js').RenderNode>,
            options?:  Record<string, any>
        }> {
            preview: {
                settings: import('./preview/settings.js').Settings,
                nodes: {
                    preview?:  import('./preview/preview-node.js').PreviewNode,
                    output?:   import('./common/nodes/output-node.js').OutputNode,
                    post?:     import('./common/nodes/post-node.js').PostNode,
                    grid?:     import('./common/nodes/grid-node.js').GridNode,
                    taa?:      import('./common/nodes/taa-node.js').TAANode,
                    outline?:  import('./common/nodes/outline-node.js').OutlineNode,
                }
            },
            query: {
                settings: import('./query/settings.js').Settings,
                nodes: {
                    output?:   import('./common/nodes/output-node.js').OutputNode,
                }
                options:  { point: { x: number, y: number }, bounds: { min: [number, number], max: [number, number] } },
            },
        }
    }
}
