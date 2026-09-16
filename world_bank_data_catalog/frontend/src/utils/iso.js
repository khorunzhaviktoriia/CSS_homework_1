import { alpha3ToAlpha2 } from "i18n-iso-countries";

export function iso2(code3) {
  return (alpha3ToAlpha2(code3) || code3.slice(0, 2)).toLowerCase();
}

export function flagUrl(code3, width = 40) {
  return `https://flagcdn.com/w${width}/${iso2(code3)}.png`;
}
