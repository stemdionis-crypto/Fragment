var fragmentSkins = [{"id":"classic","free":true},{"id":"operator","free":false},{"id":"wanderer","free":false},{"id":"phantom","free":false}];
var fragmentItems = [{"id":"head-none","slot":"head","free":true},{"id":"headphones","slot":"head","free":false},{"id":"beanie","slot":"head","free":false},{"id":"beret","slot":"head","free":false},{"id":"face-none","slot":"face","free":true},{"id":"mask-skull","slot":"face","free":false},{"id":"mask-plague","slot":"face","free":false},{"id":"mask-oni","slot":"face","free":false},{"id":"mask-welder","slot":"face","free":false},{"id":"mask-respirator","slot":"face","free":false},{"id":"glasses","slot":"face","free":false},{"id":"scarf","slot":"face","free":false},{"id":"table-default","slot":"table","free":true},{"id":"table-walnut","slot":"table","free":false},{"id":"table-studio","slot":"table","free":false},{"id":"wallpaper-default","slot":"wallpaper","free":true},{"id":"wallpaper-botanical","slot":"wallpaper","free":false},{"id":"wallpaper-artdeco","slot":"wallpaper","free":false},{"id":"lighting-default","slot":"lighting","free":true},{"id":"lighting-amber","slot":"lighting","free":false},{"id":"lighting-moon","slot":"lighting","free":false},{"id":"poster-default","slot":"poster","free":true},{"id":"poster-signal","slot":"poster","free":false},{"id":"poster-moon","slot":"poster","free":false},{"id":"decor-none","slot":"decor","free":true},{"id":"decor-lantern","slot":"decor","free":false},{"id":"decor-plant","slot":"decor","free":false},{"id":"decor-tapes","slot":"decor","free":false},{"id":"victory-default","slot":"victory","free":true},{"id":"victory-sparks","slot":"victory","free":false},{"id":"victory-rings","slot":"victory","free":false},{"id":"victory-stars","slot":"victory","free":false}];

function check(result) { if (!result.Success) throw new Error('Platform operation rejected'); return result.Data; }
function fragmentSaved() { var d=check(server.GetUserCustomData()); var r=d.ReadOnly && d.ReadOnly.fragment_profile; return r && r.Value ? JSON.parse(r.Value) : { equipped:'classic',loadout:{} }; }
handlers.fragmentProfile = function(args,context) { var saved=fragmentSaved(); var d=check(server.GetUserCustomData()); var r=d.ReadOnly && d.ReadOnly.fragment_signal_stats; if(r && r.Value) saved.stats=JSON.parse(r.Value); else { var old=d.ReadOnly && d.ReadOnly.fragment_stats; if(old && old.Value) { saved.stats=JSON.parse(old.Value); saved.stats.totalSignalsEarned=0; } } return saved; };
handlers.fragmentNickname = function(args,context) {
  var nickname=args && typeof args.nickname==='string' ? args.nickname.trim() : '';
  if(!nickname || nickname.length>16 || /[\u0000-\u001f\u007f]/.test(nickname)) throw new Error('Use 1–16 characters');
  var saved=fragmentSaved(); saved.nickname=nickname;
  check(server.SetUserCustomData('ReadOnly','fragment_profile',JSON.stringify(saved)));
  return {nickname:nickname};
};
handlers.fragmentEquip = function(args,context) {
  var id=args && args.id;
  var skin=fragmentSkins.filter(function(i){return i.id===id;})[0];
  var item=fragmentItems.filter(function(i){return i.id===id;})[0];
  if (!skin && !item) throw new Error('Unknown Fragment item');
  var raw=server.ReadUserData(['InventoryV2']);
  if (!raw || !raw.InventoryV2) throw new Error('Inventory unavailable');
  var inv=raw.InventoryV2;
  var totals=(inv.Items || {})['fragment_'+id];
  if (!(skin || item).free && (!totals || totals.TotalAmount < 1)) throw new Error('Item is not owned');
  var saved=fragmentSaved(); saved.loadout=saved.loadout || {};
  if (skin) saved.equipped=id; else saved.loadout[item.slot]=id;
  check(server.SetUserCustomData('ReadOnly','fragment_profile',JSON.stringify(saved)));
  return saved;
};
handlers.fragmentMatch = function(args,context) {
  if (!args || !/^[a-f0-9]{64}$/.test(args.receipt)) throw new Error('Invalid receipt');
  var response=check(server.HttpRequest({Method:'GET',Url:'https://fragment-demo.onrender.com/api/idos/receipt/'+args.receipt}));
  if (!response.Ok || response.BodyTooLarge) throw new Error('Match confirmation unavailable');
  var receipt=JSON.parse(response.Body);
  if (receipt.userId!==context.UserID || !receipt.ready || receipt.day!==new Date().toISOString().slice(0,10)) throw new Error('Signals rewards are not active');
  if (!Number.isInteger(receipt.earned) || receipt.earned<0 || receipt.earned>50) throw new Error('Invalid reward amount');
  // Maximum aggregation is replay-safe: a repeat cannot add another reward.
  check(server.AddQuestProgress('fragment_signals_verified_daily',receipt.earned));
  check(server.SetUserCustomData('ReadOnly','fragment_signal_stats',JSON.stringify({wins:receipt.wins,gamesPlayed:receipt.gamesPlayed,fastestSeconds:receipt.fastestSeconds,totalSignalsEarned:receipt.totalSignalsEarned})));
  return {verified:true,earned:receipt.earned};
};
