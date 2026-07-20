// Canonical race-aware player hairstyle catalog and Canvas2D style renderer.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  const entry = (id, raceId, name, renderKey, tags = [], supportsColor = true) => Object.freeze({
    id, raceId, name, category: 'hair', genderSupport: 'all', supportsColor,
    thumbnailKey: id, renderKey, tags: Object.freeze(tags)
  });
  const CATALOGS = Object.freeze({
    human: Object.freeze([
      entry('human_bald','human','Bald','bald'), entry('human_short','human','Short Crop','short'),
      entry('human_medium','human','Layered Medium','medium'), entry('human_long','human','Long','long'),
      entry('human_ponytail','human','Ponytail','ponytail'), entry('human_braided','human','Side Braid','braid'),
      entry('human_wild','human','Wild Waves','wild'), entry('human_undercut','human','Shaved Sides','undercut')
    ]),
    elf: Object.freeze([
      entry('elf_short_elegant','elf','Short Elegant','elf_short'), entry('elf_layered_medium','elf','Layered Medium','elf_medium'),
      entry('elf_long_straight','elf','Long Straight','elf_long'), entry('elf_high_ponytail','elf','High Ponytail','elf_ponytail'),
      entry('elf_noble_braids','elf','Noble Braids','elf_braids'), entry('elf_flowing_long','elf','Flowing Long','elf_flowing'),
      entry('elf_side_sweep','elf','Side Sweep','elf_sweep'), entry('elf_ranger_tie','elf','Ranger Tie-Back','elf_ranger')
    ]),
    ratkin: Object.freeze([
      entry('ratkin_bare','ratkin','Bare Fur','bare',[],false), entry('ratkin_short_scruff','ratkin','Short Scruff','rat_short'),
      entry('ratkin_tunnel_fringe','ratkin','Tunnel Fringe','rat_fringe'), entry('ratkin_tied_mane','ratkin','Tied Mane','rat_tied'),
      entry('ratkin_scavenger_braids','ratkin','Scavenger Braids','rat_braids'), entry('ratkin_wild_scruff','ratkin','Wild Scruff','rat_wild'),
      entry('ratkin_mohawk','ratkin','Mohawk Scruff','rat_mohawk'), entry('ratkin_slick','ratkin','Slick Low Fur','rat_slick')
    ]),
    bogling: Object.freeze([
      entry('bogling_smooth','bogling','Smooth Crown','smooth',[],false), entry('bogling_short_crest','bogling','Short Crest','bog_crest'),
      entry('bogling_slick_ridge','bogling','Slick Ridge','bog_ridge'), entry('bogling_reed_knot','bogling','Reed Knot','bog_knot'),
      entry('bogling_marsh_tuft','bogling','Marsh Tuft','bog_tuft'), entry('bogling_ceremonial_wrap','bogling','Ceremonial Wrap','bog_wrap'),
      entry('bogling_moss_crest','bogling','Moss Crest','bog_moss'), entry('bogling_swamp_topknot','bogling','Swamp Topknot','bog_topknot')
    ])
  });
  const DEFAULTS = Object.freeze({human:'human_short',elf:'elf_short_elegant',ratkin:'ratkin_short_scruff',bogling:'bogling_smooth'});
  const LEGACY_INDEX = Object.freeze({bald:0,shaved:0,short:1,pixie:1,medium:2,curls:2,long:3,loosewaves:5,ponytail:4,bun:4,braid:5,twinbraids:4,wild:6,mohawk:6,undercut:7,topknot:7});
  const raceId = value => DR.normalizeRaceId?.(value) || (CATALOGS[value] ? value : 'human');
  function stylesFor(race) { return CATALOGS[raceId(race)] || CATALOGS.human; }
  function normalize(race, style) {
    const id=raceId(race),list=stylesFor(id),raw=String(style||'').toLowerCase();
    const exact=list.find(item=>item.id===raw); if(exact)return exact.id;
    const legacy=raw.replace(/^(human|elf|ratkin|bogling)_/,'');
    const index=LEGACY_INDEX[legacy]; return index == null ? DEFAULTS[id] : (list[Math.min(index,list.length-1)]?.id || DEFAULTS[id]);
  }
  function definition(race, style) { const id=normalize(race,style); return stylesFor(race).find(item=>item.id===id) || stylesFor(race)[0]; }
  function colorShade(hex, amount) {
    const raw=String(hex||'#4b3628').replace('#',''); if(!/^[0-9a-f]{6}$/i.test(raw))return hex;
    return '#'+[0,2,4].map(i=>Math.max(0,Math.min(255,parseInt(raw.slice(i,i+2),16)+amount)).toString(16).padStart(2,'0')).join('');
  }
  const line=(c,x1,y1,x2,y2,color,w=2)=>{c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
  const ellipse=(c,x,y,rx,ry,fill,stroke='#17151a',lw=1)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(lw){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}};
  const poly=(c,pts,fill,stroke='#17151a',lw=1.2)=>{c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();c.fillStyle=fill;c.fill();if(lw){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}};
  function braid(c,x,y,length,color,scale=1){for(let i=0;i<5;i++)ellipse(c,x+(i%2?1.4:-1.4)*scale,y+i*length/5,2.8*scale,3.2*scale,color,'#21140f',.6*scale);line(c,x,y+length-2*scale,x,y+length+2*scale,'#c3a45c',2*scale);}

  function drawHumanoid(c,rig,palette) {
    const actor=rig.actor||{},def=definition(actor.raceId||'human',actor.hairStyle),key=def.renderKey,h=rig.anchors.head,d=rig.dir||{},s=d.side||1;
    if(['bald','bare','smooth'].includes(key))return true;
    const base=actor.hairColor||palette.hair||'#4b3628',hi=colorShade(base,35),dark=colorShade(base,-38),rx=h.rx||12;
    const cap=(depth=3)=>poly(c,[[h.x-rx-2,h.y-2],[h.x-rx+1,h.y-13],[h.x-3*s,h.y-19],[h.x+rx+2,h.y-10],[h.x+rx*.55,h.y+depth],[h.x-rx*.55,h.y+depth+2]],base,dark,1.4);
    if(d.backVisible){
      if(/long|flowing|medium/.test(key))poly(c,[[h.x-rx-2,h.y-12],[h.x+rx+2,h.y-12],[h.x+rx+3,h.y+(/medium/.test(key)?13:25)],[h.x-rx-3,h.y+(/medium/.test(key)?13:25)]],base,dark,1.3);else cap();return true;
    }
    if(/long|flowing/.test(key)){poly(c,[[h.x-rx-3,h.y-13],[h.x+rx+3,h.y-12],[h.x+rx+2,h.y+(/flowing/.test(key)?27:21)],[h.x+4*s,h.y+15],[h.x-rx-2,h.y+24]],base,dark,1.5);line(c,h.x-rx+2,h.y-7,h.x-rx-1,h.y+19,hi,1.2);if(/elf/.test(key))line(c,h.x+rx-1,h.y-7,h.x+rx+1,h.y+20,hi,1);return true;}
    if(/ponytail|ranger/.test(key)){cap();ellipse(c,h.x+17*s,h.y-(/elf/.test(key)?7:0),5,16,base,dark,1);line(c,h.x+13*s,h.y-7,h.x+19*s,h.y-7,'#c4a15a',2);return true;}
    if(/braid/.test(key)){cap();braid(c,h.x+14*s,h.y,25,base,1);if(/braids/.test(key))braid(c,h.x-14*s,h.y,22,base,.9);return true;}
    if(/undercut/.test(key)){ellipse(c,h.x,h.y-6,rx-1,4,dark,dark,.8);poly(c,[[h.x-3*s,h.y-18],[h.x+10*s,h.y-15],[h.x+7*s,h.y-6],[h.x-2*s,h.y-8]],base,dark,1);line(c,h.x-8*s,h.y-5,h.x+7*s,h.y-3,hi,1);return true;}
    if(/wild/.test(key)){poly(c,[[h.x-rx-3,h.y],[h.x-rx,h.y-14],[h.x-8,h.y-19],[h.x-3,h.y-16],[h.x+2,h.y-23],[h.x+6,h.y-16],[h.x+rx+3,h.y-12],[h.x+rx,h.y+5],[h.x+6,h.y+1],[h.x,h.y+7],[h.x-6,h.y+1]],base,dark,1.5);return true;}
    if(/sweep/.test(key)){poly(c,[[h.x-rx-2,h.y-4],[h.x-rx+2,h.y-15],[h.x+7*s,h.y-20],[h.x+rx+4*s,h.y-4],[h.x+3*s,h.y+5],[h.x-5*s,h.y-1]],base,dark,1.4);line(c,h.x-7*s,h.y-12,h.x+8*s,h.y-3,hi,1.1);return true;}
    if(/medium/.test(key)){cap(8);line(c,h.x-rx,h.y-2,h.x-rx-1,h.y+12,hi,1.2);line(c,h.x+rx,h.y-1,h.x+rx+1,h.y+11,dark,2);return true;}
    cap(); if(/elf_short/.test(key))line(c,h.x-7*s,h.y-13,h.x+8*s,h.y-5,hi,1.2); return true;
  }

  function drawRaceStyle(c,actor,head,scale=1) {
    const def=definition(actor.raceId,actor.hairStyle),k=def.renderKey,x=head.x,y=head.y,s=scale,color=actor.hairColor||'#4b3628',hi=colorShade(color,38),race=raceId(actor.raceId);
    if(['bare','smooth'].includes(k))return true;
    if(race==='ratkin'){
      if(k==='rat_slick'){ellipse(c,x,y-12*s,10*s,3*s,color,'#211914',s);return true;}
      if(k==='rat_mohawk'){poly(c,[[x-3*s,y-10*s],[x,y-27*s],[x+4*s,y-10*s]],color,'#211914',s);return true;}
      const spikes=k==='rat_wild'?7:k==='rat_short'?3:5,spread=k==='rat_wild'?15:11;
      for(let i=0;i<spikes;i++){const px=x-spread*s+i*(spread*2/(spikes-1))*s,peak=y-(k==='rat_fringe'&&i>spikes/2?18:13+Math.abs(i-spikes/2)*2)*s;poly(c,[[px-3*s,y-7*s],[px,peak],[px+4*s,y-7*s]],i%2?hi:color,'#211914',.7*s);}
      if(k==='rat_tied'){line(c,x+10*s,y-6*s,x+17*s,y+14*s,color,5*s);line(c,x+12*s,y-3*s,x+16*s,y-3*s,'#c29b52',2*s);}
      if(k==='rat_braids'){braid(c,x-10*s,y-5*s,19*s,color,s);braid(c,x+10*s,y-5*s,19*s,color,s);}
      return true;
    }
    const green=actor.hairColor||'#58733d',reed='#b59a4d',moss='#557a42';
    if(k==='bog_crest'||k==='bog_moss'){for(let i=-2;i<=2;i++)poly(c,[[x+i*6*s-3*s,y-10*s],[x+i*6*s,y-(18+Math.abs(i)*2)*s],[x+i*6*s+3*s,y-10*s]],k==='bog_moss'?moss:green,'#253522',.7*s);}
    else if(k==='bog_ridge'){for(let i=-3;i<=3;i++)ellipse(c,x+i*5*s,y-(12+Math.cos(i)*2)*s,4*s,3*s,green,'#253522',.7*s);}
    else if(k==='bog_knot'||k==='bog_topknot'){for(let i=-2;i<=2;i++)line(c,x+i*2*s,y-9*s,x+i*4*s,y-24*s,reed,1.5*s);ellipse(c,x,y-24*s,k==='bog_topknot'?6*s:4*s,k==='bog_topknot'?5*s:4*s,green,'#253522',s);}
    else if(k==='bog_tuft'){for(let i=-2;i<=2;i++)line(c,x+i*2*s,y-9*s,x+i*5*s,y-(20+Math.abs(i)*2)*s,green,2*s);}
    else if(k==='bog_wrap'){poly(c,[[x-18*s,y-10*s],[x+18*s,y-10*s],[x+16*s,y-4*s],[x-16*s,y-4*s]],'#8d6b3d','#302517',s);line(c,x-15*s,y-7*s,x+14*s,y-7*s,'#d0ab5d',s);}
    return true;
  }
  function drawSpriteOverlay(c,actor,bounds){
    const race=raceId(actor.raceId);if(!['ratkin','bogling'].includes(race))return false;
    const scale=Math.max(.35,bounds.height/108),head={x:bounds.x,y:bounds.y-bounds.height*.72};return drawRaceStyle(c,actor,head,scale);
  }
  function drawThumbnail(c,race,style,color='#4b3628'){
    const w=c.canvas.width,h=c.canvas.height;c.clearRect(0,0,w,h);const id=raceId(race),actor={raceId:id,hairStyle:normalize(id,style),hairColor:color};
    c.save();c.scale(w/52,h/52);ellipse(c,26,31,id==='bogling'?15:11,id==='bogling'?9:13,id==='ratkin'?'#777a78':id==='bogling'?'#4f8b55':'#d8a87e','#17151a',1);
    if(id==='ratkin'){poly(c,[[16,25],[18,9],[23,23]],'#d9a8a2');poly(c,[[36,25],[34,9],[29,23]],'#d9a8a2');}
    if(id==='bogling'){ellipse(c,17,23,5,5,'#7aaa62');ellipse(c,35,23,5,5,'#7aaa62');}
    if(id==='human'||id==='elf')drawHumanoid(c,{actor,anchors:{head:{x:26,y:29,rx:11}},dir:{side:1,backVisible:false}},{hair:color});else drawRaceStyle(c,actor,{x:26,y:29},1);c.restore();
  }
  DR.Hairstyles=Object.freeze({catalogs:CATALOGS,defaults:DEFAULTS,stylesFor,normalize,definition,drawHumanoid,drawRaceStyle,drawSpriteOverlay,drawThumbnail});
})();
