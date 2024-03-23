declare namespace Revelry {

    namespace Renderer {

        interface RenderPaths {
            standard:  import('./standard/standard-path.js').StandardRenderPath,
            preview:   import('./preview/preview-path.js').PreviewRenderPath,
            solid:     import('./solid/solid-path.js').SolidRenderPath,
            wireframe: import('./wireframe/wireframe-path.js').WireframeRenderPath,
            query:     import('./query/query-path.js').QueryRenderPath,
        }

        type RenderPathKeys = Extract<keyof RenderPaths, string>;

        type RenderPathSettingsFlags<T extends RenderPathKeys = RenderPathKeys>   = Parameters<RenderPaths[T]['settings']['reconfigure']>[0];
        type RenderPathSettingsValues<T extends RenderPathKeys = RenderPathKeys>  = Parameters<RenderPaths[T]['settings']['reconfigure']>[1];
        type RenderPathSettingsOptions<T extends RenderPathKeys = RenderPathKeys> = { renderPath: T, flags?: RenderPathSettingsFlags<T>, values?: RenderPathSettingsValues<T> };
    }
}
