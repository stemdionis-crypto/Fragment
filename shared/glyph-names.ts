// What each picture is, so nobody has to guess a line drawing.
// Shown on your own cards and buttons; the radio still jams these words in chat.
import type { Glyph, L } from './protocol';

export const GLYPH_NAMES: Record<Glyph, L> = {
  triangle: { en: 'triangle', ru: 'треугольник' }, circle: { en: 'circle', ru: 'круг' }, square: { en: 'square', ru: 'квадрат' }, cross: { en: 'cross', ru: 'крест' },
  star: { en: 'star', ru: 'звезда' }, moon: { en: 'moon', ru: 'луна' }, eye: { en: 'eye', ru: 'глаз' }, key: { en: 'key', ru: 'ключ' },
  candle: { en: 'candle', ru: 'свеча' }, cup: { en: 'cup', ru: 'чашка' }, clock: { en: 'clock', ru: 'часы' }, knife: { en: 'knife', ru: 'нож' },
  book: { en: 'book', ru: 'книга' }, coin: { en: 'coin', ru: 'монета' }, feather: { en: 'feather', ru: 'перо' }, bottle: { en: 'bottle', ru: 'бутылка' },
  cat: { en: 'cat', ru: 'кот' }, owl: { en: 'owl', ru: 'сова' }, fish: { en: 'fish', ru: 'рыба' }, spider: { en: 'spider', ru: 'паук' },
  crow: { en: 'crow', ru: 'ворона' }, snake: { en: 'snake', ru: 'змея' }, rabbit: { en: 'rabbit', ru: 'заяц' }, moth: { en: 'moth', ru: 'мотылёк' },
  antenna: { en: 'antenna', ru: 'антенна' }, cassette: { en: 'cassette', ru: 'кассета' }, bell: { en: 'bell', ru: 'колокольчик' }, hourglass: { en: 'hourglass', ru: 'песочные часы' },
  compass: { en: 'compass', ru: 'компас' }, lantern: { en: 'lantern', ru: 'фонарь' }, gear: { en: 'gear', ru: 'шестерёнка' }, lock: { en: 'padlock', ru: 'замок' },
  cloud: { en: 'cloud', ru: 'туча' }, sun: { en: 'sun', ru: 'солнце' }, rain: { en: 'rain', ru: 'дождь' }, snowflake: { en: 'snowflake', ru: 'снежинка' },
  lightning: { en: 'lightning', ru: 'молния' }, wind: { en: 'wind', ru: 'ветер' }, umbrella: { en: 'umbrella', ru: 'зонт' }, thermometer: { en: 'thermometer', ru: 'градусник' },
  microphone: { en: 'microphone', ru: 'микрофон' }, headphones: { en: 'headphones', ru: 'наушники' }, record: { en: 'vinyl record', ru: 'пластинка' }, dial: { en: 'dial', ru: 'регулятор' },
  speaker: { en: 'speaker', ru: 'динамик' }, battery: { en: 'battery', ru: 'батарейка' }, wire: { en: 'wire', ru: 'провод' }, switch: { en: 'switch', ru: 'выключатель' },
};
