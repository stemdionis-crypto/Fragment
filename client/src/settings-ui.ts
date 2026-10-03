import { defaults, settings, updateSettings, type Settings } from './settings';
import { lang, setLang } from './i18n';
import { sfx } from './audio';

const copy = {
  ru: {
    title: 'Настройки', audio: 'Звук', visuals: 'Изображение', general: 'Общее',
    master: 'Общая громкость', music: 'Музыка', ambience: 'Фон и шум радио', effects: 'Звуки действий',
    muted: 'Выключить весь звук', backgroundAudio: 'Звук в фоновой вкладке', camera: 'Камера следует за говорящим',
    reducedMotion: 'Уменьшить движение и тряску', filmGrain: 'Зернистость плёнки', flashes: 'Вспышки помех',
    language: 'Язык интерфейса', close: 'Готово', reset: 'По умолчанию', test: 'Проверить звук',
    note: 'Настройки сохраняются автоматически на этом устройстве. Партия продолжается, пока меню открыто.',
  },
  en: {
    title: 'Settings', audio: 'Audio', visuals: 'Display', general: 'General',
    master: 'Master volume', music: 'Music', ambience: 'Ambience and radio hiss', effects: 'Sound effects',
    muted: 'Mute all audio', backgroundAudio: 'Audio in background tabs', camera: 'Camera follows the speaker',
    reducedMotion: 'Reduce motion and shaking', filmGrain: 'Film grain', flashes: 'Static flashes',
    language: 'Interface language', close: 'Done', reset: 'Restore defaults', test: 'Test sound',
    note: 'Settings are saved automatically on this device. The round continues while this menu is open.',
  },
};

let settingsLauncher: HTMLButtonElement | null = null;
export function placeSettingsButton() {
  const slot = document.querySelector('.hud, .home-top, .card-top');
  if (slot && settingsLauncher && settingsLauncher.parentElement !== slot) slot.append(settingsLauncher);
}

export function initSettingsUI() {
  const launcher = document.createElement('button');
  launcher.className = 'settings-launcher';
  settingsLauncher = launcher;
  launcher.setAttribute('aria-haspopup', 'dialog');
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'settings-title');
  document.body.append(launcher, dialog);

  function render() {
    const c = copy[lang];
    launcher.textContent = `⚙ ${c.title}`;
    const slider = (key: 'master' | 'music' | 'ambience' | 'effects') => `<label class="setting-slider" for="setting-${key}"><span>${c[key]}</span><output id="value-${key}">${settings[key]}%</output><input id="setting-${key}" data-volume="${key}" type="range" min="0" max="100" step="1" value="${settings[key]}" /></label>`;
    const toggle = (key: 'muted' | 'backgroundAudio' | 'camera' | 'reducedMotion' | 'filmGrain' | 'flashes') => `<label class="setting-toggle"><input type="checkbox" data-toggle="${key}" ${settings[key] ? 'checked' : ''} /><span>${c[key]}</span></label>`;
    dialog.innerHTML = `<div class="settings-heading"><h2 id="settings-title">${c.title}</h2><button id="settings-x" aria-label="${c.close}">×</button></div>
      <fieldset><legend>${c.audio}</legend>${slider('master')}${slider('music')}${slider('ambience')}${slider('effects')}${toggle('muted')}${toggle('backgroundAudio')}<button id="sound-test">${c.test}</button></fieldset>
      <fieldset><legend>${c.visuals}</legend>${toggle('camera')}${toggle('reducedMotion')}${toggle('filmGrain')}${toggle('flashes')}</fieldset>
      <fieldset><legend>${c.general}</legend><label class="setting-language">${c.language}<select id="settings-lang"><option value="ru" ${lang === 'ru' ? 'selected' : ''}>Русский</option><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option></select></label></fieldset>
      <p class="fine">${c.note}</p><div class="settings-footer"><button id="settings-reset">${c.reset}</button><button id="settings-done" class="primary">${c.close}</button></div>`;
    dialog.querySelectorAll<HTMLInputElement>('[data-volume]').forEach((input) => {
      input.oninput = () => {
        const key = input.dataset.volume as keyof Settings;
        updateSettings({ [key]: Number(input.value) });
        dialog.querySelector(`#value-${key}`)!.textContent = `${input.value}%`;
      };
    });
    dialog.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach((input) => {
      input.onchange = () => updateSettings({ [input.dataset.toggle!]: input.checked });
    });
    dialog.querySelector<HTMLSelectElement>('#settings-lang')!.onchange = (event) => {
      setLang((event.target as HTMLSelectElement).value as 'ru' | 'en');
      window.dispatchEvent(new Event('fragment:language'));
      render();
      dialog.querySelector<HTMLSelectElement>('#settings-lang')!.focus();
    };
    dialog.querySelector<HTMLButtonElement>('#sound-test')!.onclick = () => sfx.open();
    dialog.querySelector<HTMLButtonElement>('#settings-reset')!.onclick = () => { updateSettings({ ...defaults }); render(); };
    for (const id of ['settings-x', 'settings-done']) dialog.querySelector<HTMLButtonElement>(`#${id}`)!.onclick = () => dialog.close();
  }
  launcher.onclick = () => { render(); dialog.showModal(); };
  dialog.addEventListener('close', () => launcher.focus());
  window.addEventListener('fragment:language', () => { launcher.textContent = `⚙ ${copy[lang].title}`; });
  render();
}
