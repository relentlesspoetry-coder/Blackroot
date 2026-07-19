// Distinct Canvas2D Bogling and Ratkin player models; no gameplay mutation.
(() => {
  'use strict';
  const DR=window.DreamRealms=window.DreamRealms||{}; DR.render=DR.render||{};
  const Anim=DR.render.HumanoidAnimationSystem||{}, Gear=DR.render.PaperdollEquipmentRenderer||{}, TAU=Math.PI*2;
  const ellipse=(c,x,y,rx,ry,fill,stroke='#17151a',lw=1.2)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();if(lw){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}};
  const line=(c,x1,y1,x2,y2,color,w=2)=>{c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
  const poly=(c,p,fill,stroke='#17151a')=>{c.beginPath();c.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)c.lineTo(p[i].x,p[i].y);c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=1.2;c.stroke();};
  // Tapered limb mass: a filled quad from (x1,y1) to (x2,y2) with independent start/end half-widths
  // plus rounded caps at both joints, so a limb reads as solid anatomy instead of a thin stroked line.
  // Drawing a slightly narrower `hi` (skin) pass over a wider `shadow` pass fakes a lit/shaded round form.
  const limbMass=(c,x1,y1,x2,y2,w1,w2,skin,shadow)=>{
    const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    const quad=(sw1,sw2)=>[{x:x1+nx*sw1,y:y1+ny*sw1},{x:x2+nx*sw2,y:y2+ny*sw2},{x:x2-nx*sw2,y:y2-ny*sw2},{x:x1-nx*sw1,y:y1-ny*sw1}];
    poly(c,quad(w1,w2),shadow,shadow);ellipse(c,x1,y1,w1,w1*.86,shadow,shadow,0);ellipse(c,x2,y2,w2,w2*.86,shadow,shadow,0);
    const inset=.72;poly(c,quad(w1*inset,w2*inset),skin,shadow);ellipse(c,x1,y1,w1*inset,w1*inset*.86,skin,shadow,1);ellipse(c,x2,y2,w2*inset,w2*inset*.86,skin,shadow,1);
  };
  const cycleSample=(values,phase)=>{const n=values.length,p=((Number(phase)||0)%1+1)%1*n,i=Math.floor(p)%n,f=p-Math.floor(p),a=Number(values[i])||0,b=Number(values[(i+1)%n])||0;return a+(b-a)*f;};
  const boglingWalkCycle=(phase,female)=>{const weight=female?.82:1;return {body:cycleSample([1,4,0,-4,-6,3,1,1],phase)*weight,lift:cycleSample([0,0,2,6,8,1,0,0],phase)*weight,compress:cycleSample([.2,1,.55,.15,0,.9,.45,.2],phase),spread:cycleSample([1,1.08,.96,.78,.82,1.12,1.04,1],phase),sway:cycleSample([0,-1.2,-2,0,1.4,2,1,0],phase)*weight,air:cycleSample([0,0,.15,.72,1,.12,0,0],phase)};};
  const boglingSwimCycle=phase=>({tuck:cycleSample([0,.35,1,.72,.05,0,0,.22],phase),power:cycleSample([0,0,0,.45,1,.72,.2,0],phase),spread:cycleSample([.72,.52,.38,.68,1,.92,.7,.58],phase),glide:cycleSample([1,.55,0,.15,.15,.55,1,.8],phase),armSweep:cycleSample([.15,.35,.72,1,.7,.35,.12,.08],phase)});
  // Jump is a one-shot ballistic arc, not a looping gait: deep crouch (coil) -> explosive leg
  // extension off the ground -> tucked-leg airborne apex -> legs reaching back down -> compressed
  // landing. `lift` drives how far the whole body rises off the ground plane; `tuck` pulls the
  // frog legs up under the body at the apex instead of leaving them dangling straight down.
  const boglingJumpCycle=phase=>({crouch:cycleSample([1,.35,-.55,-.85,-.35,.55],phase),lift:cycleSample([0,.12,.62,.92,.55,.05],phase),tuck:cycleSample([0,.15,.65,1,.5,.05],phase),armSwing:cycleSample([-.25,.35,.85,1,.5,-.15],phase)});
  // Shared amphibian digit+webbing helper for Bogling hands/feet: fans `count` tapered rounded
  // digits out from (bx,by) around dirAngle, then fills a separate concave membrane polygon in
  // each gap between adjacent digits (webbing never reaches the tips). Used by both hands and
  // feet so male/female and every color palette share one anatomy source instead of two blobs.
  const digitFan=(c,bx,by,dirAngle,count,spread,len,baseW,tipW,skin,shadow,hi,web,webRatio=.6)=>{
    const digits=[];
    for(let i=0;i<count;i++){
      const k=count>1?(i/(count-1))*2-1:0,ang=dirAngle+k*spread/2,dlen=len*(1-Math.abs(k)*.24);
      const dx=Math.cos(ang),dy=Math.sin(ang),nx=-dy,ny=dx,bw=baseW*.5*(1-Math.abs(k)*.12);
      const tipX=bx+dx*dlen,tipY=by+dy*dlen;
      digits.push({ang,dlen,dx,dy,nx,ny,bw,tipX,tipY});
    }
    // Membranes belong below the digits. Painting them afterward blurred the toe contours into a
    // single light fan and made pale palettes read as scratches rather than amphibian anatomy.
    for(let i=0;i<count-1;i++){
      const A=digits[i],B=digits[i+1];
      const aX=bx+A.dx*A.dlen*webRatio+A.nx*A.bw*.4,aY=by+A.dy*A.dlen*webRatio+A.ny*A.bw*.4;
      const bX=bx+B.dx*B.dlen*webRatio-B.nx*B.bw*.4,bY=by+B.dy*B.dlen*webRatio-B.ny*B.bw*.4;
      const cAng=(A.ang+B.ang)/2,cLen=Math.min(A.dlen,B.dlen)*webRatio*.6,cx2=bx+Math.cos(cAng)*cLen,cy2=by+Math.sin(cAng)*cLen;
      c.save();c.globalAlpha=.82;c.beginPath();c.moveTo(bx+A.nx*A.bw*.3,by+A.ny*A.bw*.3);
      c.quadraticCurveTo((bx+aX)/2,(by+aY)/2,aX,aY);c.quadraticCurveTo(cx2,cy2,bX,bY);
      c.quadraticCurveTo((bx+bX)/2,(by+bY)/2,bx-B.nx*B.bw*.3,by-B.ny*B.bw*.3);c.closePath();
      c.fillStyle=web;c.fill();c.globalAlpha=.48;c.strokeStyle=shadow;c.lineWidth=.8;c.stroke();c.restore();
    }
    for(const q of digits){
      poly(c,[{x:bx+q.nx*q.bw,y:by+q.ny*q.bw},{x:q.tipX+q.nx*tipW,y:q.tipY+q.ny*tipW},{x:q.tipX-q.nx*tipW,y:q.tipY-q.ny*tipW},{x:bx-q.nx*q.bw,y:by-q.ny*q.bw}],skin,shadow);
      ellipse(c,q.tipX,q.tipY,tipW*1.32,tipW*1.08,skin,shadow,.7);
      c.save();c.globalAlpha=.58;ellipse(c,q.tipX-q.dx*tipW*.22,q.tipY-q.dy*tipW*.22,tipW*.68,tipW*.42,hi,null,0);c.restore();
      line(c,bx+q.dx*q.dlen*.2,by+q.dy*q.dlen*.2,bx+q.dx*q.dlen*.72,by+q.dy*q.dlen*.72,shadow,.55);
    }
    return digits;
  };
  const paletteFor=a=>{const r=DR.getRaceDefinition?.(a.raceId),id=DR.normalizeRacePaletteId?.(a.raceId,a.racePaletteId);return r?.palettes?.[id]||{};};
  const boglingProfile=a=>{const race=DR.getRaceDefinition?.('bogling'),gender=String(a?.gender||'male').toLowerCase()==='female'?'female':'male';return race?.genderVariants?.[gender]||race?.genderVariants?.male||{id:'male',bodyScale:1,torsoWidth:1,torsoHeight:1,shoulderScale:1,limbScale:1,headScale:1,eyeScale:1,pouchScale:1,ridgeScale:1,handScale:1,footScale:1,crouchOffset:0};};
  function buildRaceRig(actor,pose,palette){
    const x=actor.screenX||0,y=actor.screenY||0,d=pose.direction||{},side=d.side||0,bob=pose.torsoBob||0,med=pose.action==='meditate'?10:0,swim=pose.swimming?10:0,death=(pose.death||0)*18;
    const jumpLift=pose.action==='jump'?boglingJumpCycle(pose.jumpPhase).lift*28:0;
    const bog=actor.raceId==='bogling',bp=bog?boglingProfile(actor):null,chest={x:x+side*2,y:y-(bog?43:48)+bob+med+swim+death-jumpLift}, pelvis={x,y:y-(bog?24:25)+med+swim+death-jumpLift};
    const fw=bog?17:12, shoulder=bog?24:17, footY=y-1+death-jumpLift;
    const headX=x+side*(bog?4:7),headY=chest.y-(bog?29:31),headRx=bog?31*(bp?.headScale||1):16,headRy=bog?20*(bp?.headScale||1):18;
    const anchors={chest,pelvis,head:{x:headX,y:headY,rx:headRx,ry:headRy,top:headY-headRy,bottom:headY+headRy},helmet:{x:headX,y:headY-(bog?8:11),rx:headRx,ry:headRy},
      mainHand:{x:x+(shoulder+8)*(d.nearSide||1),y:chest.y+20+(pose.cast||0)*-18},offHand:{x:x-(shoulder+8)*(d.nearSide||1),y:chest.y+20+(pose.cast||0)*-18},
      shoulders:{left:{x:x-shoulder,y:chest.y-8},right:{x:x+shoulder,y:chest.y-8}},
      arms:{far:{shoulder:{x:x-shoulder,y:chest.y-8},elbow:{x:x-shoulder-5,y:chest.y+8},hand:{x:x-shoulder-8,y:chest.y+20}},near:{shoulder:{x:x+shoulder,y:chest.y-8},elbow:{x:x+shoulder+5,y:chest.y+8},hand:{x:x+shoulder+8,y:chest.y+20}}},
      legs:{far:{sign:-1,hip:{x:x-fw/2,y:pelvis.y},knee:{x:x-fw-5,y:footY-15},ankle:{x:x-fw-2,y:footY-2},foot:{x:x-fw,y:footY}},near:{sign:1,hip:{x:x+fw/2,y:pelvis.y},knee:{x:x+fw+5,y:footY-15},ankle:{x:x+fw+2,y:footY-2},foot:{x:x+fw,y:footY}}},
      anatomy:{shoulders:{},elbows:{},wrists:{},hands:{},hips:{},knees:{},ankles:{},feet:{}}};
    const action=String(pose.action||'idle'),near=d.nearSide||1,far=-near,t=Number(pose.t||0),gatherKind=String(pose.gatheringKind||actor.gatheringKind||'').toLowerCase();
    if(action==='walk'&&bog){
      const hop=boglingWalkCycle(pose.walkPhase,bp?.id==='female'),balance=24+hop.air*5;
      anchors.mainHand={x:x+near*balance,y:chest.y+18-hop.air*6};anchors.offHand={x:x+far*balance,y:chest.y+18-hop.air*6};
    }else if(action==='meditate'){
      // Bogling hands rest on the knees, above the feet. The shared drawArm() step below adds the
      // full meditate crouch (9px) plus a 2px palm nudge on top of this anchor, so the anchor itself
      // must sit that much higher than the visual target or the palm's digit fan lands on top of the
      // foot's webbed toes instead of beside them (they previously merged into one unreadable cluster).
      anchors.mainHand={x:x+near*(bog?20:13),y:pelvis.y+(bog?1:9)};anchors.offHand={x:x+far*(bog?20:13),y:pelvis.y+(bog?1:9)};
      anchors.legs.far.knee.y=footY-7;anchors.legs.near.knee.y=footY-7;anchors.legs.far.foot.x=x-(bog?25:16);anchors.legs.near.foot.x=x+(bog?25:16);
    }else if(action==='swim'){
      if(bog){const frog=boglingSwimCycle(pose.swimPhase),reach=29+frog.glide*8-frog.armSweep*5;anchors.mainHand={x:x+near*reach,y:chest.y+3-frog.glide*5+frog.armSweep*5};anchors.offHand={x:x+far*reach,y:chest.y+3-frog.glide*5+frog.armSweep*5};anchors.legs.far.foot.x=x-(25+frog.power*16-frog.tuck*7);anchors.legs.near.foot.x=x+(25+frog.power*16-frog.tuck*7);anchors.legs.far.foot.y=footY-7-frog.tuck*12+frog.power*3;anchors.legs.near.foot.y=footY-7-frog.tuck*12+frog.power*3;}
      else {const stroke=Number(pose.swimStroke||0),kick=Number(pose.swimKick||0);anchors.mainHand={x:x+near*22+stroke*8,y:chest.y+5-stroke*5};anchors.offHand={x:x+far*22-stroke*8,y:chest.y+5+stroke*5};anchors.legs.far.foot.x=x-19-kick*9;anchors.legs.near.foot.x=x+19+kick*9;anchors.legs.far.foot.y=footY-8;anchors.legs.near.foot.y=footY-8;}
    }else if(action==='jump'){
      // Both feet tuck up together (a frog leaps off two legs at once, unlike the alternating
      // walk gait), and the arms swing up through the launch for momentum/balance.
      const j=boglingJumpCycle(pose.jumpPhase);
      if(bog){const reach=22+j.armSwing*15;anchors.mainHand={x:x+near*reach,y:chest.y+6-j.armSwing*26};anchors.offHand={x:x+far*reach,y:chest.y+6-j.armSwing*26};anchors.legs.far.foot.y=footY-j.tuck*17;anchors.legs.near.foot.y=footY-j.tuck*17;anchors.legs.far.foot.x=x-(14+j.tuck*9);anchors.legs.near.foot.x=x+(14+j.tuck*9);}
      else {anchors.mainHand={x:x+near*20,y:chest.y+4-j.armSwing*20};anchors.offHand={x:x+far*20,y:chest.y+4-j.armSwing*20};anchors.legs.far.foot.y=footY-j.tuck*11;anchors.legs.near.foot.y=footY-j.tuck*11;}
    }else if(action==='dance'){
      const sway=Math.sin(Number(pose.danceCycle||0)*Math.PI*2),bounce=Math.abs(Math.cos(Number(pose.danceCycle||0)*Math.PI*2));anchors.mainHand={x:x+near*(bog?31:21),y:chest.y-5+sway*10};anchors.offHand={x:x+far*(bog?31:21),y:chest.y-5-sway*10};anchors.legs.near.foot.y-=bounce*3;anchors.head.x+=sway*(bog?3:5);
    }else if(action==='fishing'){
      const reel=String(actor.fishingAction||'')==='reeling'?Math.sin(t*15)*2:0;anchors.mainHand={x:x+near*(bog?27:19),y:chest.y+18+reel};anchors.offHand={x:x+near*(bog?10:7),y:chest.y+23+reel*.6};
    }else if(action==='gathering'&&gatherKind==='mining'){
      const swing=Math.sin(Number(pose.gatherLoop||0)*Math.PI*2);anchors.mainHand={x:x+near*(18+swing*9),y:chest.y-18+swing*18};anchors.offHand={x:x-near*(8-swing*4),y:chest.y-4+swing*16};
    }else if(action==='gathering'){
      const reach=Math.max(0,Number(pose.gatherCutPhase||0));anchors.mainHand={x:x+near*(bog?28:19),y:footY-4-reach*4};anchors.offHand={x:x+near*(bog?13:9),y:footY-1};
    }
    return {actor,pose,palette,dir:d,anchors,equipmentAnchorProfile:actor.raceId};
  }
  function bogling(c,a,p,rig,pal){
    const A=rig.anchors,d=p.direction||{},front=d.faceVisible!==false,back=d.backVisible===true,side=d.side||0,diag=Math.abs(side)>.1&&Math.abs(side)<.95;
    // Which physical leg (A.legs.far has a fixed sign of -1, A.legs.near a fixed sign of +1 -- those
    // signs only place them left/right on screen, they are not a "this one is closer to camera" claim)
    // plays the near/prominent draw role has to follow d.nearSide per facing, exactly like mainHand and
    // offHand already do below. Without this, the +1-sign leg was always drawn last at full opacity and
    // the -1-sign leg always dimmed first, regardless of facing -- correct for south/east (nearSide 1)
    // but backwards for north/west/northwest/southwest (nearSide -1), where the leg that should recede
    // behind the body was instead the one painted on top of it.
    const legNear=(d.nearSide||1)>=0?A.legs.near:A.legs.far,legFar=legNear===A.legs.near?A.legs.far:A.legs.near;
    const skin=pal.skinMain||pal.skin||'#4f8b55',shadow=pal.skinShadow||'#28543a',hi=pal.skinHighlight||'#86bd70',belly=pal.belly||'#b2c982',throat=pal.throatPouch||belly,web=pal.webbing||belly,spots=pal.spots||pal.spot||'#254d32',ridge=pal.ridge||spots,iris=pal.iris||a.eyeColor||'#e0c75b',mouth=pal.mouth||'#542f3c',wet=pal.wetHighlight||'rgba(209,255,226,.42)',profile=boglingProfile(a),female=profile.id==='female';
    const x=A.pelvis.x,action=String(p.action||a.action||'idle'),breath=Math.sin((p.t||0)*3.1+(a.id||0))*.8,cast=Number(p.cast||0),hit=Number(p.hit||0),swim=action==='swim'||p.swimming,walking=action==='walk',jumping=action==='jump',death=Number(p.death||0);
    const hop=boglingWalkCycle(p.walkPhase,female),frog=boglingSwimCycle(p.swimPhase),jump=boglingJumpCycle(p.jumpPhase),danceBounce=action==='dance'?Math.abs(Math.sin((p.danceCycle||0)*Math.PI*2))*-4:0;
    // Attack/hit both read off the shared attackCurve (a 0->1->0 bell peaking mid-swing): legs coil
    // (extra crouch) through the windup and spring back out through the strike, instead of the attack
    // being an arms-only animation with the lower body just standing there in the idle pose.
    const atk=Number(p.attackCurve||0),attacking=action==='attack';
    // Jump reuses the same crouch/bodyY channel as every other pose: a strongly negative jump.crouch
    // value (the airborne apex) stretches the body upward out of its usual compressed stance, instead
    // of a separate uncoordinated "floating" offset that would fight the shared torso/leg draw code.
    const crouch=(swim?7-frog.glide*2:action==='meditate'?9:walking?3+hop.compress*2:jumping?2+jump.crouch*9:attacking?2+atk*6:2)+profile.crouchOffset+danceBounce+(walking?hop.body:0),bodyY=A.chest.y+16+crouch,head={x:A.head.x+side*3+(walking?hop.sway*.45:0),y:A.head.y+8+crouch+(swim?3:0)};
    // Pelvis/haunch center: computed up front (before the torso is drawn) so the leg chain below and
    // the visible hip mass drawn later both key off the same value instead of drifting apart.
    const hipY=bodyY+12;
    // 1. Contact shadow.
    const groundY=(a.screenY||0)-1+death;
    c.save();c.globalAlpha=.3*(1-death*.5)*(walking?1-hop.air*.48:jumping?1-jump.lift*.7:1);ellipse(c,x,groundY+3,38-(jumping?jump.lift*14:0)+(walking?hop.air*3:0),8-(jumping?jump.lift*4:0),'#020504',null,0);c.restore();
    Gear.drawBodyLayer?.(c,rig,'back','back');
    // 2-3. Far folded frog leg: haunch and thigh only. Frog-leg chain rebuilt so the hip socket sits
    // tucked *inside* the haunch mass instead of at its outer edge (the old hip.x landed exactly on the
    // torso silhouette, i.e. a visible seam with zero overlap). The thigh is short and broad -- real
    // frog haunches are thick, not elongated -- while the shin (drawn later, after the torso) does the
    // visible vertical work down to a grounded foot, so the pair reads as a bent, weight-bearing leg
    // instead of one flat flipper pasted under the belly.
    // Both legs' thighs are drawn now (before the torso) and both legs' shins+feet are drawn later
    // (after the torso). Previously the *entire* far leg was drawn before the torso and the *entire*
    // near leg after: the far knee/shin/foot sat outside the torso's silhouette anyway, so it never
    // actually got covered -- it just floated next to the body with no visible connective tissue,
    // since the one segment that *did* connect it (the proximal thigh) was hidden behind the torso.
    // Splitting the draw so every foot lands after the torso keeps both feet continuously connected to
    // their (now-visible-up-to-the-knee) thighs, with only alpha/shading distinguishing near from far.
    const legPose=(l,near)=>{const sideView=Math.abs(side)>.94;
      // In a strict profile view the far leg sits almost directly behind the near leg anatomically, so
      // its lateral spread (but not its foot target, which drives the actual walk/swim/meditate poses)
      // is pulled toward center instead of mirroring the near leg's outward stance.
      const sideTuck=sideView&&!near?.55:1;
      const hip={x:x+l.sign*15*profile.bodyScale*sideTuck+(walking?hop.sway*.3:0),y:hipY-3+crouch*.4};
      const kneeSpread=swim?(24+frog.tuck*13+frog.power*9):(36*hop.spread),knee={x:x+l.sign*kneeSpread*profile.bodyScale*sideTuck+(sideView?side*3:0),y:hip.y+8-(swim?frog.tuck*7+frog.power*4:walking?hop.lift*.4:0)};
      const swimReach=swim?(5+frog.power*16-frog.tuck*8):0,ankle={x:l.foot.x+l.sign*(swimReach||4)*sideTuck+(sideView?side*(swim?7:5):0),y:l.foot.y-(swim?4+frog.tuck*13-frog.power*2:2)-(walking?hop.lift:0)};
      l.hip={...hip};l.knee={...knee};l.ankle={...ankle};l.foot={x:ankle.x,y:ankle.y+2};
      const key=near?'near':'far';A.anatomy.hips[key]=hip;A.anatomy.knees[key]=knee;A.anatomy.ankles[key]=ankle;A.anatomy.feet[key]=l.foot;};
    const drawThigh=(l,near)=>{const ls=profile.limbScale,sideView=Math.abs(side)>.94;c.save();
      // In a strict profile view the far leg anatomically sits almost directly behind the near leg, not
      // spread out beside it, so it should mostly disappear rather than compete for attention as an
      // equally-solid second limb.
      c.globalAlpha=near?1:(sideView?.4:.7);legPose(l,near);const hip=l.hip,knee=l.knee;
      // Haunch bridge: a wide flat mass spanning from the body centerline out to the hip socket. Two
      // large ellipses (pelvis, femur ball) touching at a single tangent point still reads as a pinched
      // "figure-8" seam to the eye; filling that gap with its own mass removes the pinch so belly, hip
      // and thigh read as one continuous silhouette instead of three separate touching blobs.
      limbMass(c,x+l.sign*3*profile.bodyScale,hipY,hip.x,hip.y,11*profile.bodyScale,13*ls,skin,shadow);
      // Femur root: a broad ball at the hip socket, enlarged and drawn before the thigh mass so the
      // thigh visibly plugs into it rather than sprouting from a bare point beside the belly. Because
      // the socket now sits well inside the haunch footprint (not at its rim), the pelvis/torso drawn
      // afterward naturally overlaps its proximal half instead of leaving a hard seam.
      ellipse(c,hip.x+l.sign*2.5,hip.y+3,17.5*ls,14*ls,shadow,shadow,.92);
      ellipse(c,hip.x+l.sign*1.5,hip.y+2,15*ls,11.8*ls,skin,shadow,1);
      // Thigh (broad, femur-mass) tapering into the knee, a filled tapered mass instead of a stroked
      // line, so it reads as solid anatomy. The shin picks up from this exact knee point after the
      // torso is drawn, so there is never a gap between the visible thigh and the visible shin.
      limbMass(c,hip.x,hip.y,knee.x,knee.y,14*ls,9.5*ls,skin,shadow);
      c.restore();};
    const drawShinFoot=(l,near)=>{const ls=profile.limbScale,fs=profile.footScale,sideView=Math.abs(side)>.94;c.save();c.globalAlpha=near?1:(sideView?.4:.7);
      const knee=l.knee,ankle=l.ankle;
      limbMass(c,knee.x,knee.y,ankle.x,ankle.y,8.5*ls,5.5*ls,skin,shadow);
      ellipse(c,knee.x-l.sign*.9,knee.y-2,2.9*ls,2.3*ls,hi,null,0);
      ellipse(c,knee.x+l.sign*1.3,knee.y+2.5,2.1*ls,1.7*ls,shadow,null,0);
      const footAng=swim?(l.sign>0?.16:Math.PI-.16):sideView?(side>0?.38:Math.PI-.38):(Math.PI/2-l.sign*(diag?.36:.52));
      const ux=Math.cos(footAng),uy=Math.sin(footAng),nx=-uy,ny=ux,toeBase={x:ankle.x+ux*5.2*fs,y:ankle.y+uy*5.2*fs};
      // Angular heel-to-toe base creates a grounded wedge instead of an oval/blob silhouette.
      poly(c,[{x:ankle.x-nx*4.2*fs,y:ankle.y-ny*4.2*fs},{x:toeBase.x-nx*8.5*fs,y:toeBase.y-ny*8.5*fs},{x:toeBase.x+nx*8.5*fs,y:toeBase.y+ny*8.5*fs},{x:ankle.x+nx*4.2*fs,y:ankle.y+ny*4.2*fs}],skin,shadow);
      c.save();c.globalAlpha=.58;poly(c,[{x:ankle.x-nx*3.7*fs,y:ankle.y-ny*3.7*fs},{x:toeBase.x-nx*8*fs,y:toeBase.y-ny*8*fs},{x:toeBase.x-nx*2*fs,y:toeBase.y-ny*2*fs}],shadow,shadow);c.restore();
      const swimFan=swim?(.58+frog.spread*.62):1;digitFan(c,toeBase.x,toeBase.y,footAng,4,(near?1.08:.9)*swimFan,(swim?12+frog.spread*4:11.5)*fs,5.3*fs,2.15*fs,skin,shadow,hi,web,.64);
      if(!back){c.save();c.globalAlpha=.52*(near?1:.7);line(c,ankle.x-nx*2,ankle.y-ny*2,toeBase.x-nx*2.8,toeBase.y-ny*2.8,wet,1.1);c.restore();}
      line(c,knee.x-l.sign*3,knee.y-5,ankle.x-l.sign*2,ankle.y-3,hi,1.15,.85);c.restore();};
    drawThigh(legFar,false);
    // 4. Far arm, bent elbow, broad hand and membranes.
    const drawArm=(hand,sign,near)=>{const ls=profile.limbScale,hs=profile.handScale;c.save();c.globalAlpha=near?1:.68;
      // Shoulder/elbow must follow the hand's actual screen side, not the caller's fixed handedness sign: mainHand/offHand
      // anchors flip with d.nearSide per facing (e.g. west/north/northwest/southwest), so a fixed sign here previously
      // stretched the forearm clear across the torso to reach a hand that had flipped to the opposite side.
      const armSign=Math.sign(hand.x-A.chest.x)||sign;
      const shoulder={x:A.chest.x+armSign*21*profile.shoulderScale,y:bodyY-11};
      const rawElbow={x:A.chest.x+armSign*(25*profile.shoulderScale+cast*5),y:bodyY+(near?3:6)-cast*8};
      const rawPalm={x:hand.x-armSign*(female?4:2)+armSign*(cast*4),y:hand.y-cast*13+crouch+2};
      // Resolve activity targets as bounded local limb segments. Equipment and tool anchors consume
      // the resulting hand position; they never pull the wrist into world space or across the back.
      const bounded=(from,to,max)=>{const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);return !Number.isFinite(len)||len<.001?{x:from.x+armSign*max*.55,y:from.y+max*.7}:len<=max?to:{x:from.x+dx/len*max,y:from.y+dy/len*max};};
      const elbow=bounded(shoulder,rawElbow,22*ls),palm=bounded(elbow,rawPalm,28*ls);
      hand.x=palm.x;hand.y=palm.y;
      const key=near?'near':'far';A.anatomy.shoulders[key]={...shoulder};A.anatomy.elbows[key]={...elbow};A.anatomy.wrists[key]={...palm};A.anatomy.hands[key]=hand;
      A.arms[key]={shoulder:{...shoulder},elbow:{...elbow},wrist:{...palm},hand,sign:armSign,hiddenBehindTorso:false};
      line(c,shoulder.x,shoulder.y,elbow.x,elbow.y,shadow,10*ls);line(c,shoulder.x,shoulder.y,elbow.x,elbow.y,skin,7*ls);line(c,elbow.x,elbow.y,palm.x,palm.y,shadow,8*ls);line(c,elbow.x,elbow.y,palm.x,palm.y,skin,5*ls);
      // Palm faces along the forearm so the finger fan always points away from the wrist, whichever pose moved the hand target (idle/meditate/swim/cast/tool grips all reuse this).
      const palmR=7.4*hs,handAng=Math.atan2(palm.y-elbow.y,palm.x-elbow.x)||(armSign>0?0:Math.PI),baseX=palm.x+Math.cos(handAng)*palmR*.5,baseY=palm.y+Math.sin(handAng)*palmR*.5;
      if(back)c.globalAlpha*=.9;
      ellipse(c,palm.x,palm.y,palmR,palmR*.82,skin,shadow,1);
      digitFan(c,baseX,baseY,handAng,near?4:3,near?1.0:.8,(near?11:8.5)*hs,4.6*hs,1.75*hs,skin,shadow,hi,web,.56);
      c.restore();Gear.drawBodyLayer?.(c,rig,'arm',key);};
    drawArm(A.offHand,-1,false);
    // In north/back views both arms belong behind the barrel torso. Previously the near arm was
    // drawn later in the front-view order, producing the apparent limb stretched across the back.
    if(back)drawArm(A.mainHand,1,true);
    // 5-6. Hip/pelvis mass, squat barrel torso, and separated belly material.
    // Frogs are wider at the haunches than at the chest. Drawing a wide hip ellipse first, then the
    // narrower chest/belly ellipse on top (centered higher, its lower curve overlapping the hip's
    // upper curve), makes the hip visibly flare out past the chest silhouette on both sides instead
    // of one uniform circle: that flare is exactly where each thigh sockets in below. The belly's
    // vertical reach is trimmed from its old size (it used to extend almost to the ground, leaving
    // no room for a leg to read as anything but a flat blob) so the torso visibly tapers into the
    // hip instead of sitting on the floor by itself.
    const hipRX=36*profile.bodyScale*(d.torsoScaleX||1),hipRY=13*profile.bodyScale;
    ellipse(c,x,hipY+2,hipRX,hipRY,shadow,shadow,1.2);ellipse(c,x,hipY,hipRX*.92,hipRY*.9,skin,shadow,1.4);
    ellipse(c,A.chest.x,bodyY+2,(swim?34:29)*profile.torsoWidth*(d.torsoScaleX||1),(swim?19:20)*profile.torsoHeight,shadow);ellipse(c,A.chest.x,bodyY,(swim?31:26)*profile.torsoWidth*(d.torsoScaleX||1),(swim?17:18)*profile.torsoHeight,skin,shadow,1.5);
    if(!back){ellipse(c,A.chest.x+side*2,bodyY+2,17*profile.torsoWidth*(diag?.88:1),12*profile.torsoHeight,belly,'rgba(28,39,27,.45)',.8);line(c,A.chest.x-10*profile.torsoWidth,bodyY-1,A.chest.x+10*profile.torsoWidth,bodyY-1,hi,1,.38);line(c,A.chest.x-8,bodyY+6,A.chest.x+8,bodyY+6,shadow,1,.35);ellipse(c,A.chest.x-14*profile.torsoWidth,bodyY-9,5,3,spots,null,0);}
    else {for(let i=-2;i<=2;i++)ellipse(c,A.chest.x+i*8,bodyY-20-Math.abs(i)*2,3.3*profile.ridgeScale,4*profile.ridgeScale,ridge,shadow,.6);}
    Gear.drawBodyLayer?.(c,rig,'torso');
    // 7-9. Near thigh, then both shins/feet (far first, near second so a crossed near foot still reads
    // in front), then the near arm.
    drawThigh(legNear,true);
    // Near-leg hip socket: the haunch bridge above is behind the belly/near thigh by draw order, so
    // this small overlapping shadow fakes the same "socketed into the hip" recess for the front leg.
    c.save();c.globalAlpha=.4;ellipse(c,A.anatomy.hips.near.x,A.anatomy.hips.near.y-3,13*profile.bodyScale,8*profile.bodyScale,shadow,null,0);c.restore();
    drawShinFoot(legFar,false);
    drawShinFoot(legNear,true);
    Gear.drawBodyLayer?.(c,rig,'legs');Gear.drawBodyLayer?.(c,rig,'back','front');if(!back)drawArm(A.mainHand,1,true);
    // 10. Broad skull and cheek planes.
    const headW=(back?31:36)*profile.headScale*(d.headScaleX||1)*(diag?.94:1),headH=(back?19:21)*profile.headScale;
    poly(c,[{x:head.x-headW,y:head.y+5},{x:head.x-headW*.78,y:head.y-10},{x:head.x-headW*.35,y:head.y-16},{x:head.x+headW*.4,y:head.y-16},{x:head.x+headW*.82,y:head.y-9},{x:head.x+headW,y:head.y+6},{x:head.x+headW*.7,y:head.y+18},{x:head.x-headW*.7,y:head.y+18}],skin,shadow);
    ellipse(c,head.x-side*7,head.y+8,headW*.67,14,skin,null,0);ellipse(c,head.x-headW*.66,head.y+5,6.5,9.5,shadow,null,0);ellipse(c,head.x+headW*.66,head.y+5,6.5,9.5,shadow,null,0);
    if(back){for(let i=-3;i<=3;i++){ellipse(c,head.x+i*8,head.y-12-Math.abs(i)*1.2,3.5*profile.ridgeScale,3.2*profile.ridgeScale,ridge,shadow,.6);if(i%2===0)ellipse(c,head.x+i*8,head.y+1,2.4,1.7,spots,null,0);}DR.Hairstyles?.drawRaceStyle?.(c,a,head,female?.92:1);Gear.drawBodyLayer?.(c,rig,'head');return;}
    // 11-12. Articulated wide mouth and breathing gular pouch.
    const mouthY=head.y+10,visibleWidth=side&&!diag?headW*.76:headW*.86;
    c.beginPath();c.moveTo(head.x-visibleWidth,mouthY-1);c.quadraticCurveTo(head.x,mouthY+(female?2:3),head.x+visibleWidth,mouthY-1+side);c.quadraticCurveTo(head.x,mouthY+(female?7:8),head.x-visibleWidth,mouthY-1);c.closePath();c.fillStyle=mouth;c.fill();c.strokeStyle=shadow;c.lineWidth=1.3;c.stroke();
    c.beginPath();c.moveTo(head.x-visibleWidth,mouthY-2);c.quadraticCurveTo(head.x,mouthY+1,head.x+visibleWidth,mouthY-2+side);c.strokeStyle=shadow;c.lineWidth=2.3;c.stroke();
    line(c,head.x-visibleWidth*.7,mouthY+3,head.x+visibleWidth*.68,mouthY+4,hi,1,.35);ellipse(c,head.x-visibleWidth,mouthY,2.4,2.2,shadow,null,0);ellipse(c,head.x+visibleWidth,mouthY,2.4,2.2,shadow,null,0);
    const pouchPulse=action==='cast'?5+cast*4:action==='meditate'?2+Math.sin((p.t||0)*2)*2:action==='dance'?2+Math.sin((p.t||0)*6)*1.5:breath;
    ellipse(c,head.x+side*5,head.y+21,17*profile.pouchScale*(diag?.86:1)+pouchPulse*.25,8*profile.pouchScale+pouchPulse*.18,shadow,shadow,.8);ellipse(c,head.x+side*5,head.y+20,15.5*profile.pouchScale*(diag?.86:1)+pouchPulse*.25,6.7*profile.pouchScale+pouchPulse*.18,throat,shadow,.8);
    for(let i=-1;i<=1;i++)line(c,head.x-9+i*9+side*4,head.y+19,head.x-7+i*8+side*4,head.y+23,shadow,.8);line(c,head.x-7+side*4,head.y+17,head.x+8+side*4,head.y+17,wet,.8);
    // 13-14. Raised eyes with lid membranes and direction-aware visibility.
    const blink=Math.max(hit*.8,(Math.sin((p.t||0)*.63+(a.id||1))>.992)?.9:.06),eyeSigns=side&&!diag?[side]:[-1,1];
    for(const sign of eyeSigns){const dominant=!diag||sign===Math.sign(side||1),eyeScale=(dominant?1:.72)*profile.eyeScale,ex=head.x+sign*(diag?17:20)*profile.headScale+side*2,ey=head.y-12-(female?1:0)+(dominant?0:2);c.save();c.globalAlpha=dominant?1:.72;ellipse(c,ex,ey,10.8*eyeScale,11*eyeScale,shadow,shadow,1);ellipse(c,ex,ey-1,9.3*eyeScale,9.5*eyeScale,skin,shadow,1.2);ellipse(c,ex+side*1.5,ey,5.5*eyeScale,Math.max(.9,5.5*eyeScale*(1-blink)),iris,'#182019',1);ellipse(c,ex+side*2,ey,1.9*eyeScale,4.2*eyeScale*(1-blink),'#101313',null,0);ellipse(c,ex-2,ey-3,1.7*eyeScale,1.3*eyeScale,'rgba(255,255,255,.82)',null,0);line(c,ex-7*eyeScale,ey-6,ex+7*eyeScale,ey-(female?7:8),ridge,2.5*eyeScale*profile.ridgeScale);line(c,ex-6*eyeScale,ey+6,ex+6*eyeScale,ey+7,shadow,1);c.restore();}
    // 15-16. Nostrils and tympanic discs.
    ellipse(c,head.x-4+side*5,head.y+2,1.4,1,shadow,null,0);ellipse(c,head.x+4+side*5,head.y+2,1.4,1,shadow,null,0);ellipse(c,head.x-headW*.78,head.y+3,6,6.5,spots,shadow,.8);ellipse(c,head.x+headW*.78,head.y+3,6,6.5,spots,shadow,.8);
    // 18-20. Crown bumps, palette markings and damp highlights.
    for(let i=-2;i<=2;i++)ellipse(c,head.x+i*9,head.y-15-Math.abs(i),2.7*profile.ridgeScale,2.3*profile.ridgeScale,ridge,shadow,.5);
    for(const q of [[-17,1],[13,5],[-8,7],[19,-2]])ellipse(c,head.x+q[0],head.y+q[1],2.7,1.8,spots,null,0);
    c.save();c.globalAlpha=.18;ellipse(c,head.x-11,head.y+5,10,5,spots,null,0);ellipse(c,A.chest.x+12,bodyY-3,8,5,spots,null,0);ellipse(c,A.legs.near.knee.x,A.legs.near.knee.y-4,6,3,spots,null,0);c.restore();
    c.save();c.fillStyle=wet;ellipse(c,head.x-headW*.34,head.y-7,8,2.6,wet,null,0);ellipse(c,A.chest.x-8,bodyY-12,5,2,wet,null,0);line(c,head.x-headW*.65,head.y+14,head.x-headW*.25,head.y+16,wet,1.2);c.restore();
    // 21-22. Edge light, race head style and equipment.
    line(c,head.x-headW*.8,head.y-5,head.x-headW*.62,head.y-12,hi,1.4);DR.Hairstyles?.drawRaceStyle?.(c,a,head,female?.92:1);
    Gear.drawBodyLayer?.(c,rig,'head');Gear.drawBodyLayer?.(c,rig,'offhand');Gear.drawBodyLayer?.(c,rig,'weapon');
  }
  function ratkin(c,a,p,rig,pal){
    const A=rig.anchors,d=p.direction||{},front=d.faceVisible!==false,fur=pal.fur||'#777a78',belly=pal.belly||'#aaa69b',accent=pal.accent||'#d9a8a2',x=A.pelvis.x,tailSide=d.side||d.nearSide||1;
    const danceFlick=p.action==='dance'?Math.sin((p.danceCycle||0)*Math.PI*2)*14:0,swimTrail=p.action==='swim'?18:0,medCurl=p.action==='meditate'?12:0;
    c.strokeStyle=fur;c.lineWidth=6;c.beginPath();c.moveTo(A.pelvis.x,A.pelvis.y+3);c.bezierCurveTo(x-tailSide*(30+swimTrail),A.pelvis.y+10+danceFlick*.2,x-tailSide*(35+swimTrail)+danceFlick,A.pelvis.y+39-medCurl,x-tailSide*(11+medCurl),A.pelvis.y+44-medCurl);c.stroke();
    Gear.drawBodyLayer?.(c,rig,'back','back');
    for(const l of [A.legs.far,A.legs.near]){line(c,l.hip.x,l.hip.y,l.knee.x,l.knee.y,fur,6);line(c,l.knee.x,l.knee.y,l.foot.x,l.foot.y,fur,5);ellipse(c,l.foot.x+l.sign*3,l.foot.y,8,3,fur);}Gear.drawBodyLayer?.(c,rig,'legs');
    ellipse(c,A.chest.x,A.chest.y+8,15*(d.torsoScaleX||1),25,fur);poly(c,[{x:A.chest.x-12,y:A.chest.y},{x:A.chest.x+12,y:A.chest.y},{x:A.pelvis.x+11,y:A.pelvis.y+10},{x:A.pelvis.x-11,y:A.pelvis.y+10}],a.clothesPrimary||'#5f5144');Gear.drawBodyLayer?.(c,rig,'torso');Gear.drawBodyLayer?.(c,rig,'back','front');
    for(const [hand,s] of [[A.mainHand,1],[A.offHand,-1]]){line(c,A.chest.x+s*13,A.chest.y,hand.x,hand.y,fur,4.5);ellipse(c,hand.x,hand.y,4,3,fur);}
    const h=A.head; poly(c,[{x:h.x-14,y:h.y-5},{x:h.x-11,y:h.y-28},{x:h.x-2,y:h.y-11}],accent);poly(c,[{x:h.x+14,y:h.y-5},{x:h.x+11,y:h.y-28},{x:h.x+2,y:h.y-11}],accent);
    ellipse(c,h.x,h.y+3,16*(d.headScaleX||1),18,fur); const snoutX=h.x+(d.side||0)*12,snoutY=h.y+11;ellipse(c,snoutX,snoutY,front?10:15,7,belly);ellipse(c,snoutX+(d.side||0)*10,snoutY+1,4,3,'#2b2022');
    if(front)for(const s of [-1,1]){ellipse(c,h.x+s*7,h.y-1,3,3,a.eyeColor||'#e2b45e');line(c,snoutX+s*5,snoutY+2,snoutX+s*23,snoutY-2+s*3,'#e8ddd0',1);}
    DR.Hairstyles?.drawRaceStyle?.(c,a,h,1);
    Gear.drawBodyLayer?.(c,rig,'head');Gear.drawBodyLayer?.(c,rig,'offhand');Gear.drawBodyLayer?.(c,rig,'weapon');
  }
  const api={canDraw:a=>['bogling','ratkin'].includes(String(a?.raceId||'')),buildRaceRig,getEquipmentAnchors:(a,p)=>buildRaceRig(a,p||Anim.buildPose(a),paletteFor(a)).anchors,
    draw(c,a,now){if(!api.canDraw(a))return false;const p=Anim.buildPose?.(a,now)||{direction:{faceVisible:true,nearSide:1},t:now/1000};const pal=paletteFor(a),rig=buildRaceRig(a,p,pal);c.save();
      const death=p.death||0;if(death){c.translate(a.screenX||0,a.screenY||0);c.rotate(death*(a.raceId==='ratkin'?.9:.65));c.translate(-(a.screenX||0),-(a.screenY||0));} if(a.raceId==='bogling')bogling(c,a,p,rig,pal);else ratkin(c,a,p,rig,pal);c.restore();return true;}};
  DR.render.RaceIdentityProceduralModel=Object.freeze(api);window.RaceIdentityProceduralModel=DR.render.RaceIdentityProceduralModel;
})();
