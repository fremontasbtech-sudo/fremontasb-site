// For an <img className="img-fade">: show it (fades in, see index.css) once it has loaded.
export const markLoaded = (e) => { e.currentTarget.dataset.loaded = '' }

// ref for the same <img>: an image already in the browser cache can finish loading before React
// listens for "load", so check on mount too, or it would stay invisible.
export const fadeRef = (img) => { if (img && img.complete && img.naturalWidth) img.dataset.loaded = '' }
