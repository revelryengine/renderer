declare namespace Revelry {

    namespace Renderer {

        interface RenderPaths {
            standard: {
                settings: import('./standard/standard-settings.js').StandardSettings,
                nodes: {
                    base?:    import('./standard/nodes/base-node.js').BaseNode,
                    main?:    import('./standard/nodes/main-node.js').MainNode,
                    ssao?:    import('./standard/nodes/ssao-node.js').SSAONode,
                    output?:  import('./common/nodes/output-node.js').OutputNode,

                    post?:       import('./common/nodes/post-node.js').PostNode,
                    grid?:       import('./common/nodes/grid-node.js').GridNode,
                    taa?:        import('./common/nodes/taa-node.js').TAANode,
                    outline?:    import('./common/nodes/outline-node.js').OutlineNode,
                    bloom?:      import('./standard/nodes/bloom-node.js').BloomNode,
                    lens?:       import('./standard/nodes/lens-node.js').LensNode,
                    motionBlur?: import('./standard/nodes/motion-blur-node.js').MotionBlurNode,
                },
                preNodes: {
                    audio?:       import('./standard/nodes/audio-node.js').AudioNode,
                    punctual?:    import('./standard/nodes/punctual-node.js').PunctualNode,
                    environment?: import('./standard/nodes/environment-node.js').EnvironmentNode,
                },
                options:  {},
            },
            preview: {
                settings: import('./preview/preview-settings.js').PreviewSettings,
                nodes: {
                    preview?: import('./preview/preview-node.js').PreviewNode,
                    output?:  import('./common/nodes/output-node.js').OutputNode,
                    post?:    import('./common/nodes/post-node.js').PostNode,
                    grid?:    import('./common/nodes/grid-node.js').GridNode,
                    taa?:     import('./common/nodes/taa-node.js').TAANode,
                    outline?: import('./common/nodes/outline-node.js').OutlineNode,
                },
                preNodes: {},
                options:  {},
            },
            solid: {
                settings: import('./solid/solid-settings.js').SolidSettings,
                nodes: {
                    solid?:   import('./solid/solid-node.js').SolidNode,
                    output?:  import('./common/nodes/output-node.js').OutputNode,
                    post?:    import('./common/nodes/post-node.js').PostNode,
                    grid?:    import('./common/nodes/grid-node.js').GridNode,
                    taa?:     import('./common/nodes/taa-node.js').TAANode,
                    outline?: import('./common/nodes/outline-node.js').OutlineNode,
                },
                preNodes: {},
                options:  {},
            },
            wireframe: {
                settings: import('./wireframe/wireframe-settings.js').WireframeSettings,
                nodes: {
                    wireframe?: import('./wireframe/wireframe-node.js').WireframeNode,
                    output?:    import('./common/nodes/output-node.js').OutputNode,
                    post?:      import('./common/nodes/post-node.js').PostNode,
                    grid?:      import('./common/nodes/grid-node.js').GridNode,
                    taa?:       import('./common/nodes/taa-node.js').TAANode,
                    outline?:   import('./common/nodes/outline-node.js').OutlineNode,
                },
                preNodes: {},
                options:  {},
            },
            query: {
                settings: import('./query/query-settings.js').QuerySettings,
                nodes: {
                    output?:   import('./common/nodes/output-node.js').OutputNode,
                }
                preNodes: {},
                options:  { point: { x: number, y: number }, bounds: { min: [number, number], max: [number, number] } },
            },
        }

        type RenderPathKeys = Extract<keyof RenderPaths, string>;

        type RenderPathSettingsFlags<T extends RenderPathKeys = any>   = Parameters<RenderPaths[T]['settings']['reconfigure']>[0];
        type RenderPathSettingsValues<T extends RenderPathKeys = any>  = Parameters<RenderPaths[T]['settings']['values']['set']>[0];
        type RenderPathSettingsOptions<T extends RenderPathKeys = any> = { renderPath?: T, flags?: RenderPathSettingsFlags<T>, values?: RenderPathSettingsValues<T> };
    }
}
