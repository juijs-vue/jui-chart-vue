// Port of legacy `src/pattern/classic.js` ("chart.pattern.classic", extend: null) - a flat map
// keyed '01'..'12', each value a `{type:'pattern', attr:{id:'pattern-jennifer-NN',...},
// children:[{type:'image', attr:{...base64 PNG...}}]}` SVG-pattern descriptor, byte-for-byte
// transcribed from source (already fully double-quoted JSON-like syntax, valid TS as-is - no
// reformatting needed) and mechanically verified key-for-key (including every embedded base64
// data URI) against the source.
//
// **Registration key is 'pattern.jennifer', NOT 'pattern.classic'** - traced precisely through
// `Builder.createPattern()`: for a theme color string like 'pattern-jennifer-10', it does
// `arr = obj.split('-')` -> ['pattern','jennifer','10'], `method = arr.pop()` -> '10',
// `patternKey = arr.join('.')` -> 'pattern.jennifer', then `themeRegistry.get(patternKey)` - the
// SAME registry `registerTheme()` populates (there is no separate pattern registry - patterns
// piggyback on the theme registry in the real engine, confirmed by reading `createPattern()`
// directly). `classic.js`'s own declared `name: 'chart.pattern.classic'` is irrelevant to this
// specific runtime lookup - it's leftover legacy-registry metadata from the dropped
// `jui.include()`-style module system, never consulted by `createPattern()` at all. Registering
// under 'pattern.classic' instead would leave every pattern-themed shape rendering solid black
// (the exact failure mode already observed before this fix), since `createPattern()` would keep
// missing the lookup.
//
// `pattern[method]` (e.g. `pattern['10']`) is then looked up from THAT object - i.e. this file's
// own '01'..'12' keys must survive as-is as the second-level lookup keys, which this transcription
// preserves exactly. The resulting descriptor is turned into a real SVG element generically by
// `SVG.createObject()` (confirmed: it creates ANY `{type, attr, children}` shape recursively, with
// no brush/pattern-specific special-casing - no `jui-graph-ts` gap here).
import { registerTheme } from 'jui-graph-ts'

/** One `<pattern>` SVG-pattern descriptor - generically consumed by `SVG.createObject()`
 * (`{type, attr, children}` -> a real SVG element tree, recursively, with no pattern-specific
 * special-casing - see this file's own header comment). */
interface SvgPatternDescriptor {
  type: 'pattern'
  attr: {
    id: string
    width: number
    height: number
    patternUnits: string
  }
  children: {
    type: 'image'
    attr: {
      'xlink:href': string
      width: number
      height: number
    }
  }[]
}

/** `pattern.jennifer`'s 12 named fill patterns (`'01'`..`'12'`), looked up by
 * `Builder.createPattern()` from a theme color string like `'pattern-jennifer-10'` - see this
 * file's own header comment for the exact `'pattern-jennifer-10'` -> `'10'` key-resolution path
 * and why registration under `'pattern.jennifer'`, not `'pattern.classic'`, is required. */
export const patternJenniferMap: Record<string, SvgPatternDescriptor> = {
  "10": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-10",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABZJREFUCNdjEBRg6GhgcHFgUFLAxQYAaTkFzlvDQuIAAAAASUVORK5CYII=",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "11": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-11",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABJJREFUCNdjMDZgOHOAAQxwsQF00wXOMquS/QAAAABJRU5ErkJggg==",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "12": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-12",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABBJREFUCNdj+P8BioAABxsAU88RaA20zg0AAAAASUVORK5CYII=",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "01": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-01",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABVJREFUCNdjKC9g+P+B4e4FIImLDQBPxxNXosybYgAAAABJRU5ErkJggg==",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "02": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-02",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABNJREFUCNdj6GhgAAIlBSCBiw0AUpID3xszyekAAAAASUVORK5CYII=",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "03": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-03",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAAA9JREFUCNdj+P+BAQzwMACirge9PFNsFQAAAABJRU5ErkJggg==",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "04": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-04",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAgMAAAArG7R0AAAACVBMVEUAAAAaGRkWFhUIIaslAAAAAXRSTlMAQObYZgAAACFJREFUCNdj6HBpYQABjw4wDeS7QPgtENrFxQNCe3SAKAC36AapdMh8ewAAAABJRU5ErkJggg==",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "05": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-05",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAALCwvdFFZtAAAAAXRSTlMAQObYZgAAAA1JREFUCNdjWLWAIAIAFt8Ped1+QPcAAAAASUVORK5CYII=",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "06": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-06",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAALCwvdFFZtAAAAAXRSTlMAQObYZgAAAA9JREFUCNdj+P+BAQjwkgDijAubMqjSSAAAAABJRU5ErkJggg==",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "07": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-07",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAgMAAAArG7R0AAAACVBMVEUAAAAAAAAMDAwvehODAAAAAXRSTlMAQObYZgAAAA5JREFUCNdjmDJlCikYAPO/FNGPw+TMAAAAAElFTkSuQmCC",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "08": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-08",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABZJREFUCNdjKC9gePeA4e4Fht0bcLEBM1MRaPwhp7AAAAAASUVORK5CYII=",
            "width": 12,
            "height": 12
        }
    }
      ]
  },
  "09": {
      "type": "pattern",
      "attr": {
    "id": "pattern-jennifer-09",
    "width": 12,
    "height": 12,
    "patternUnits": "userSpaceOnUse"
      },
      "children": [
    {
        "type": "image",
        "attr": {
            "xlink:href": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQMAAABsu86kAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABZJREFUCNdjePeAobyAYfcGhrsXcLEBOSARaPIjMTsAAAAASUVORK5CYII=",
            "width": 12,
            "height": 12
        }
    }
      ]
  }
}

registerTheme('pattern.jennifer', patternJenniferMap)
