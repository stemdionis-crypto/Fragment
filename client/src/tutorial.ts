import { glyphSvg } from './glyphs';
import { lang } from './i18n';

export function openTutorial() {
  const ru=lang==='ru', dialog=document.createElement('dialog');
  dialog.className='tutorial-dialog';dialog.setAttribute('aria-label',ru?'Попробовать игру':'Try the game');
  document.body.append(dialog);
  let step=0,done=false,answer='',suspicion=0,feedback='';
  const tr=(r:string,e:string)=>ru?r:e;
  function render(){
    dialog.innerHTML=`<header><span class="eyebrow">${tr('ПРОБНЫЙ ЭФИР','PRACTICE FREQUENCY')} · ${step+1}/3</span><button data-close aria-label="${tr('Закрыть','Close')}">×</button></header><div class="tutorial-progress">${[0,1,2].map(i=>`<span class="${i<=step?'on':''}"></span>`).join('')}</div>
    <h2>${[tr('У каждого свой пульт','Everyone has their own control'),tr('Ваша карточка — для соседа','Your card is for your teammate'),tr('Радио слышит прямые ответы','The radio hears direct answers')][step]}</h2>
    ${step===0?`<div class="tutorial-chain"><b>${tr('Эхо','Echo')}</b><span>→</span><b>${tr('Вы','You')}</b><span>→</span><b>${tr('Ива','Wren')}</b></div><div class="tutorial-bubble">${tr('Эхо: «У тебя то, на чём едет машина».','Echo: “Yours is what a car rolls on.”')}</div><p>${tr('Выберите ответ на своём пульте.','Choose the answer on your own control.')}</p><div class="tutorial-choices">${(['circle','key','candle'] as const).map(v=>`<button data-pick="${v}" aria-label="${v}" class="${answer===v?'chosen':''}">${glyphSvg(v,'#e3ddcf',58)}</button>`).join('')}</div>`:''}
    ${step===1?`<div class="tutorial-card"><span>${tr('Вы знаете ответ Ивы','You know Wren’s answer')}</span>${glyphSvg('candle','#e3ddcf',72)}</div><p>${tr('Передайте подсказку, не называя предмет.','Send a clue without naming the item.')}</p><div class="tutorial-choices stacked"><button data-clue="direct">${tr('Ива, у тебя свеча.','Wren, yours is a candle.')}</button><button data-clue="hint">${tr('Ива, это задувают на торте.','Wren, you blow it out on a cake.')}</button></div>`:''}
    ${step===2?`<div class="tutorial-radio">◉ <b>${suspicion}%</b><div class="tutorial-meter"><span style="width:${suspicion}%"></span></div></div><p>${tr('Нажмите и посмотрите, что меняет подозрение.','Try the actions to see how suspicion changes.')}</p><div class="tutorial-choices stacked"><button data-radio="word">${tr('Назвать предмет вслух · +30','Name the item · +30')}</button><button data-radio="solve">${tr('Решить испытание · −20','Solve a trial · −20')}</button><button data-radio="wave">${tr('Попробовать смену волны','Try a retune')}</button></div><div class="tutorial-saved">✓ ${tr('Первый этап сохранён','First trial saved')} · ✓ ${tr('Ваш пульт сохранён','Your control saved')}</div>`:''}
    <p class="tutorial-feedback" role="status">${feedback}</p><footer><button data-next class="primary" ${step<2&&!done?'disabled':''}>${step===2?tr('Готово, я понял','Done, got it'):tr('Дальше','Next')}</button></footer>`;
    dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>dialog.close();
    dialog.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b=>b.onclick=()=>{answer=b.dataset.pick!;done=answer==='circle';feedback=done?tr('Верно. Ваш ответ — колесо. Карточку соседа здесь выставлять не нужно.','Correct. Your answer is the wheel. Your teammate’s card belongs on their control.'):tr('Подумайте, на чём катится машина.','What does a car roll on?');render();});
    dialog.querySelectorAll<HTMLButtonElement>('[data-clue]').forEach(b=>b.onclick=()=>{done=b.dataset.clue==='hint';feedback=done?tr('Ива поняла намёк и выставила свой пульт. ✓','Wren understood and set her own control. ✓'):tr('Радио услышало «свеча»: +30. Попробуйте описание.','The radio heard “candle”: +30. Try describing it.');render();});
    dialog.querySelectorAll<HTMLButtonElement>('[data-radio]').forEach(b=>b.onclick=()=>{const action=b.dataset.radio;suspicion=action==='word'?Math.min(100,suspicion+30):action==='solve'?Math.max(0,suspicion-20):25;feedback=action==='wave'?tr('Волна сменилась. Подсказки и прогресс остались.','The wave changed. Your clues and progress stayed.'):action==='solve'?tr('Успешная проверка успокаивает радио.','A successful check calms the radio.'):tr('Прямое название заметнее для радио. Реплики ботов шкалу не повышают.','Direct names attract attention. Bot messages do not raise suspicion.');render();});
    dialog.querySelector<HTMLButtonElement>('[data-next]')!.onclick=()=>{if(step===2){dialog.close();return;}step++;done=false;feedback='';render();};
  }
  dialog.addEventListener('close',()=>dialog.remove());render();dialog.showModal();
}
