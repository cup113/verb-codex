import { PRONOUNS, pronounFor } from '../../src/domain/pronouns';

describe('pronounFor', () => {
  it('elides the first person before a vowel or a mute h', () => {
    expect(pronounFor(0, 'aime')).toBe("j'");
    expect(pronounFor(0, 'habite')).toBe("j'");
    expect(pronounFor(0, '')).toBe('je');
  });

  it('elides a bare form the user recorded with no stem at all', () => {
    // The whole word is the record — "avoir" is written as the bare "ai".
    expect(pronounFor(0, 'ai')).toBe("j'");
    expect(pronounFor(0, '  ai')).toBe("j'");
    expect(pronounFor(0, 'suis')).toBe('je');
  });

  it('keeps "je" before a consonant', () => {
    expect(pronounFor(0, 'finis')).toBe('je');
    expect(pronounFor(0, '  vais')).toBe('je');
  });

  it('never elides the other five rows', () => {
    PRONOUNS.forEach((pronoun, index) => {
      if (index === 0) {
        return;
      }
      expect(pronounFor(index, 'aime')).toBe(pronoun);
      expect(pronounFor(index, 'finis')).toBe(pronoun);
    });
  });
});
