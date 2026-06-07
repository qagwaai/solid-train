'use strict';

const BUST_FACE_SHAPE = Object.freeze({
  OVAL: 'oval',
  ROUND: 'round',
  SQUARE: 'square',
  ANGULAR: 'angular',
  NARROW: 'narrow',
});

const BUST_FACE_SHAPE_VALUES = Object.freeze(Object.values(BUST_FACE_SHAPE));
const BUST_FACE_SHAPE_SET = new Set(BUST_FACE_SHAPE_VALUES);

const BUST_SKIN_TONE = Object.freeze({
  PALE: 'pale',
  LIGHT: 'light',
  MEDIUM: 'medium',
  TAN: 'tan',
  DARK: 'dark',
  DEEP: 'deep',
});

const BUST_SKIN_TONE_VALUES = Object.freeze(Object.values(BUST_SKIN_TONE));
const BUST_SKIN_TONE_SET = new Set(BUST_SKIN_TONE_VALUES);

const BUST_HAIR_STYLE = Object.freeze({
  SHORT_CROP: 'short-crop',
  MID_FADE: 'mid-fade',
  LONG_LOOSE: 'long-loose',
  BRAIDED: 'braided',
  SHAVED: 'shaved',
  SLICKED: 'slicked',
});

const BUST_HAIR_STYLE_VALUES = Object.freeze(Object.values(BUST_HAIR_STYLE));
const BUST_HAIR_STYLE_SET = new Set(BUST_HAIR_STYLE_VALUES);

const BUST_HAIR_COLOR = Object.freeze({
  BLACK: 'black',
  BROWN: 'brown',
  AUBURN: 'auburn',
  BLONDE: 'blonde',
  SILVER: 'silver',
  WHITE: 'white',
  RED: 'red',
});

const BUST_HAIR_COLOR_VALUES = Object.freeze(Object.values(BUST_HAIR_COLOR));
const BUST_HAIR_COLOR_SET = new Set(BUST_HAIR_COLOR_VALUES);

const BUST_EYE_STYLE = Object.freeze({
  NARROW: 'narrow',
  WIDE: 'wide',
  ALMOND: 'almond',
  HOODED: 'hooded',
  ROUND: 'round',
});

const BUST_EYE_STYLE_VALUES = Object.freeze(Object.values(BUST_EYE_STYLE));
const BUST_EYE_STYLE_SET = new Set(BUST_EYE_STYLE_VALUES);

const BUST_EYE_COLOR = Object.freeze({
  BROWN: 'brown',
  HAZEL: 'hazel',
  GREEN: 'green',
  BLUE: 'blue',
  GREY: 'grey',
  AMBER: 'amber',
  VIOLET: 'violet',
});

const BUST_EYE_COLOR_VALUES = Object.freeze(Object.values(BUST_EYE_COLOR));
const BUST_EYE_COLOR_SET = new Set(BUST_EYE_COLOR_VALUES);

const BUST_EXPRESSION_PRESET = Object.freeze({
  NEUTRAL: 'neutral',
  FOCUSED: 'focused',
  SMIRK: 'smirk',
  STERN: 'stern',
  WARM: 'warm',
  WEARY: 'weary',
});

const BUST_EXPRESSION_PRESET_VALUES = Object.freeze(Object.values(BUST_EXPRESSION_PRESET));
const BUST_EXPRESSION_PRESET_SET = new Set(BUST_EXPRESSION_PRESET_VALUES);

const BUST_APPAREL_ACCENT = Object.freeze({
  NONE: 'none',
  COLLAR: 'collar',
  HOOD: 'hood',
  VISOR: 'visor',
  GOGGLES: 'goggles',
  HEADBAND: 'headband',
});

const BUST_APPAREL_ACCENT_VALUES = Object.freeze(Object.values(BUST_APPAREL_ACCENT));
const BUST_APPAREL_ACCENT_SET = new Set(BUST_APPAREL_ACCENT_VALUES);

const BUST_FACIAL_HAIR = Object.freeze({
  NONE: 'none',
  STUBBLE: 'stubble',
  SHORT_BEARD: 'short-beard',
  FULL_BEARD: 'full-beard',
  GOATEE: 'goatee',
});

const BUST_FACIAL_HAIR_VALUES = Object.freeze(Object.values(BUST_FACIAL_HAIR));
const BUST_FACIAL_HAIR_SET = new Set(BUST_FACIAL_HAIR_VALUES);

const BUST_SCAR = Object.freeze({
  NONE: 'none',
  CHEEK_LEFT: 'cheek-left',
  CHEEK_RIGHT: 'cheek-right',
  BROW_LEFT: 'brow-left',
  BROW_RIGHT: 'brow-right',
  CHIN: 'chin',
});

const BUST_SCAR_VALUES = Object.freeze(Object.values(BUST_SCAR));
const BUST_SCAR_SET = new Set(BUST_SCAR_VALUES);

const BUST_TATTOO = Object.freeze({
  NONE: 'none',
  TEMPLE_LEFT: 'temple-left',
  TEMPLE_RIGHT: 'temple-right',
  NECK_LEFT: 'neck-left',
  NECK_RIGHT: 'neck-right',
});

const BUST_TATTOO_VALUES = Object.freeze(Object.values(BUST_TATTOO));
const BUST_TATTOO_SET = new Set(BUST_TATTOO_VALUES);

const BUST_SCHEMA_VERSION = 'sw-15-m1-v1';

module.exports = {
  BUST_FACE_SHAPE,
  BUST_FACE_SHAPE_VALUES,
  BUST_FACE_SHAPE_SET,
  BUST_SKIN_TONE,
  BUST_SKIN_TONE_VALUES,
  BUST_SKIN_TONE_SET,
  BUST_HAIR_STYLE,
  BUST_HAIR_STYLE_VALUES,
  BUST_HAIR_STYLE_SET,
  BUST_HAIR_COLOR,
  BUST_HAIR_COLOR_VALUES,
  BUST_HAIR_COLOR_SET,
  BUST_EYE_STYLE,
  BUST_EYE_STYLE_VALUES,
  BUST_EYE_STYLE_SET,
  BUST_EYE_COLOR,
  BUST_EYE_COLOR_VALUES,
  BUST_EYE_COLOR_SET,
  BUST_EXPRESSION_PRESET,
  BUST_EXPRESSION_PRESET_VALUES,
  BUST_EXPRESSION_PRESET_SET,
  BUST_APPAREL_ACCENT,
  BUST_APPAREL_ACCENT_VALUES,
  BUST_APPAREL_ACCENT_SET,
  BUST_FACIAL_HAIR,
  BUST_FACIAL_HAIR_VALUES,
  BUST_FACIAL_HAIR_SET,
  BUST_SCAR,
  BUST_SCAR_VALUES,
  BUST_SCAR_SET,
  BUST_TATTOO,
  BUST_TATTOO_VALUES,
  BUST_TATTOO_SET,
  BUST_SCHEMA_VERSION,
};
