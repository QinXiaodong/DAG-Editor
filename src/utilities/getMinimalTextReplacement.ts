export interface TextReplacement {
  startOffset: number;
  endOffset: number;
  text: string;
}

export function getMinimalTextReplacement(currentText: string, nextText: string): TextReplacement {
  let startOffset = 0;
  const sharedLength = Math.min(currentText.length, nextText.length);
  while (startOffset < sharedLength && currentText[startOffset] === nextText[startOffset]) {
    startOffset += 1;
  }

  let currentEndOffset = currentText.length;
  let nextEndOffset = nextText.length;
  while (
    currentEndOffset > startOffset &&
    nextEndOffset > startOffset &&
    currentText[currentEndOffset - 1] === nextText[nextEndOffset - 1]
  ) {
    currentEndOffset -= 1;
    nextEndOffset -= 1;
  }

  return {
    startOffset,
    endOffset: currentEndOffset,
    text: nextText.slice(startOffset, nextEndOffset),
  };
}
