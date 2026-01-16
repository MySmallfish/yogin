import Handlebars from "handlebars";

const cache = new Map();

export function compileTemplate(id, source) {
    if (cache.has(id)) {
        return cache.get(id);
    }
    const compiled = Handlebars.compile(source);
    cache.set(id, compiled);
    return compiled;
}

