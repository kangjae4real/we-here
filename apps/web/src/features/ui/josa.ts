/** Korean particle after a name, picked by its last syllable's 받침: josa("도윤", "이", "가") → "이". */
export function josa(word: string, withFinal: string, withoutFinal: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const final = code >= 0 && code < 11172 ? code % 28 : 0;
  // (으)로 treats a ㄹ 받침 (index 8) like none: "서울로".
  return final === 0 || (withFinal === "으로" && final === 8)
    ? withoutFinal
    : withFinal;
}
