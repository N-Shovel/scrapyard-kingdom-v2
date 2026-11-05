// Same layout as the ITE-18 activities: source in src/, public files in static/, relative paths so it runs on GitHub Pages.
export default {
    root: 'src/',
    publicDir: '../static/',
    base: './',
    server:
    {
        host: true,
        open: true
    },
    build:
    {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: false,
        chunkSizeWarningLimit: 1500
    }
}
