Blackroot V0.21.16 - Band Major

Run "Blackroot V0.21.16.html" in a modern browser.

Terrain now draws band by band.

Every surface at one height is laid down before any surface above it, everywhere on screen. Higher
ground can no longer appear underneath lower ground, from any angle or across any chunk boundary.

Height is the primary ordering now. It had been distance, which allowed the height bands to interleave
between one chunk and the next - and that interleaving is what produced the corner and shoreline
artefacts throughout.

Terrain now draws in the order ground, then water, then shoreline.

It was drawing water first and then painting the land over the top of it. At a shoreline that is
backwards - water should lap over the edge of the bank, not be buried underneath it. That is what
produced the thin dark wedges wherever water met a bank.

The fault was the order of the three stages, not the ordering of pieces within any one of them.

The clipping slivers at the water's edge are gone.

Water and shoreline are now drawn in true distance order, exactly as the ground already was. This was
an oversight of mine two versions ago: I applied that ordering to the ground and not to the water or
the shoreline sitting immediately beside it in the same file, which is precisely why every remaining
glitch turned out to be at a waterline.

The triangular notch at the corners of raised terrain is gone.

Where two walls meet, a wedge of stone fills the gap between them. Every wall face was being redrawn
over the ground so it would not be covered up - but that wedge was not, so the walls survived and the
corner between them did not.

This closes the corner problem on raised terrain that had been reported across many versions.

Standing on raised ground now looks like standing on raised ground.

The far side of a plateau is hidden behind its own surface again, the way it should be - that hiding is
exactly what tells your eye you are up on top of something. Only the walls facing you are drawn over
the terrain.

This was my own regression from a few versions ago. Fixing the vanishing corners meant redrawing the
walls after the ground is laid down, and I applied that to every wall rather than only the ones you can
actually see - which left the far walls showing you their insides.

Raised ground finally looks raised.

Height was not changing the colour of the ground at all, so the top of a plateau and the land below it
came out the same shade - which left the walls looking like a divider between two flat areas rather
than the sides of something standing above the ground.

Higher ground now catches more light and lower ground sits deeper in shadow, the way open high ground
genuinely does. It reads at a glance and at any zoom.

Height had actually been inverted at the top step: the highest ground was measurably darker than the
ground below it.

Terrain now draws in true distance order.

Ground used to be drawn one chunk at a time, in whatever order the chunks happened to be collected, so
distant high ground could be painted over nearby low ground. And because which ground counts as distant
changes as you turn the camera, the problem came and went as you rotated.

That is the real cause of the corner faults on raised terrain. The last two versions kept the walls
visible in spite of the bad order. This one fixes the order itself.

Checked at all four camera angles - where the old order came out identical at every angle, which is
proof in itself that it was never following the camera at all.

Raised ground sits on top of its own wall again.

The previous version stopped the walls vanishing when you turned the camera, but it went slightly too
far the other way - the wall was allowed to spill up past its own top edge and cover the ground that is
meant to sit on top of it. That made front-facing walls look like ground tiles, and made raised ground
look like it was tucked behind its own wall.

Walls are now trimmed to exactly the face they occupy. They still cover the lower ground in front of
them, which is what stops them disappearing, and they can no longer touch anything at or above their
top edge.

Raised terrain corners no longer vanish when you turn the camera.

The walls were being drawn correctly the whole time. The ground surface is laid down on top of them
afterwards, and because that surface is stacked purely by height with no account of which way the
camera is facing, at certain angles it covered the very walls it should have been sitting behind.

That is why four earlier attempts at this failed. Each of them improved the walls themselves - their
joins, their shading, their shape - and none of it could survive being painted over a moment later.

Checked at all four camera angles, since the entire problem only showed up at some of them.

The world has shape now.

Sunlight falls from one fixed direction across the real lie of the land. Slopes facing it brighten,
slopes turned away fall into shade, and shadow pools wherever higher ground crowds in - the base of a
cliff, the bottom of a gully, the inside of a step. Every drop catches light along its top edge.

None of this is 3D. It is flat shading worked out from the actual heights of the ground, which is the
same information a 3D renderer would use - and it is why it reads as solid.

It also finally produces the shadow at the foot of cliffs that four earlier attempts failed to deliver.

All of it is baked into the cached terrain, so it costs nothing to run - the game measures 52 frames a
second with all of it active.

The ground colour is close to the reference artwork now - warm dark earth, with the remaining colour
difference more than halved and the brightness holding where it was.

Cliff faces are still smooth. A stone-texture pass for them was written and then pulled back out,
because it would have redrawn itself every single frame rather than being baked once like the ground
is. It will come back built the right way.

The ground is properly textured now.

Pebbles and small stones, fine dirt speckle, clumps of earth, cracks, moss and grass blades - instead
of flat colour with a wash laid over it. Every stone has a lit top, a shaded underside and its own
small shadow, so it sits ON the ground rather than looking painted onto it.

All of it is baked into the cached terrain, so it costs nothing while you are playing.

The ground finally looks like dark fantasy.

Warm dark earth instead of pale grey haze, with light and shade drifting slowly across it. It was
graded to match the reference artwork by measurement rather than by eye or by guesswork.

Two things were badly wrong underneath. Fog was draining almost all the colour out of the world - not
dimming it, draining it, close to grey. And the ground variation added last version had been applying
one identical tint everywhere, which is exactly why it looked like nothing had changed.

The waypoint shrine is also the right size again. The previous build rendered it several times too
large.

The ground no longer sits at one flat colour.

Every tile of a given material used to be painted the identical shade, so a field of grass read as a
single flat sheet however much fine detail was laid on top. The tone now drifts gradually across the
land - roughly one shift every nine tiles - darker in the hollows and warmer where light falls.

It is deliberately subtle, and if it proves too subtle to notice it is a single setting away from being
turned up.

The larger discovery this version made is written up in the notes: a set of ground detail routines added
in earlier versions had been running zero times per frame, because the terrain is drawn somewhere other
than where they were installed.

The waypoint is a shrine now.

A raised stone platform built from fitted masonry blocks, four ritual pillars standing on it, carved
rune rings that light from within, and a ruined arch behind it. It is nearly two tiles across. The old
one was a small glowing disc, and the graphics specification called it what it was - a glowing puddle.

The stonework is aged rather than flat: every block is toned differently, with mortar joints, chipped
corners, cracks, grime and moss. The flames, the beam of light and the drifting motes all still move.
Only the stone was made permanent; the magic is still alive on top of it.

Waypoints also stop standing on two shadows, which they had been doing since the prop-grounding update.

The world is back to its normal size.

The previous version drew everything about thirty percent smaller, because it followed the graphics
specification's literal numbers - which turned out to contradict that same document's own requirement
for LARGER tiles than before. Its prose and its numbers disagreed with each other.

Tiles keep the true isometric proportion that version introduced, exactly twice as wide as they are
tall. They are now also back to the size they were on screen, to within a quarter of a percent. The
extra height on cliffs and raised ground was kept rather than undone.

The world is drawn on a true isometric grid now.

Tiles are exactly twice as wide as they are tall - the classic isometric proportion, the one the look
this project is chasing was built on. Raised ground steps higher too, so cliffs and ledges read with
more depth. The camera settles on four headings instead of eight; turning still feels smooth while you
hold the key, and fewer angles is what makes properly drawn artwork practical later.

Everything is about thirty percent smaller on screen as a result. That is what the new grid and zoom
settings produce together. If it reads too far away, it is a single value to tune.

The buildings were floating.

Houses, shops, the well, ruin walls and pillars, and the waypoint shrine were all sitting on the ground
with nothing underneath them - no shadow where they meet the earth, which is exactly what makes an
object look pasted onto a map rather than standing in a world. Twenty-seven props are grounded now.

Some things are still shadowless, deliberately. Cave mouths and stairways are holes in the floor, and a
shadow drawn over a hole looks like a lid on it. Stalactites hang from the ceiling. A campfire does not
cast darkness underneath itself.

And every barrel in the game had been drawing its shadow twice, one directly on top of the other, which
made them noticeably darker than intended. They draw once now.

Spell light carries further now.

Magic that glows reads 10 to 21 percent brighter against the dark, so a cast looks like the brightest
thing on screen instead of part of the scenery. Solid shapes were left alone on purpose - brightening
those too would have washed out the outlines rather than the light.

Plain rings are unchanged. They already drew at full strength, so there was nothing to gain. Bolts and
caster effects are where you will see this.

The game now knows how hand-drawn artwork must be delivered, before any of it exists.

Where a sprite stands on the ground. What parts of it glow. How tall it is for the purpose of hiding
you when you walk behind it. Every frame of every direction an animation claims to have.

Artwork that gets any of this wrong is rejected at startup with the reason printed. That matters
because each of these mistakes is otherwise completely silent - a sprite that floats above the ground,
one that draws in the wrong place, or an animation that simply vanishes when you happen to turn a
certain way and nobody notices for a month.

No artwork exists yet and the game looks exactly as it did. This is the groundwork, built first so
that art arriving later drops straight in instead of needing everything rebuilt around it.

The Rogue has eleven ways to stab someone and has never once drawn a knife.

Backstab. Garrote. Silent Execution. You press the button, a ring appears on the ground, the target
takes damage, and at no point does your character appear to do anything. Every other melee class in
this game swings something. The Rogue - the class whose entire identity is a blade in the dark - has
been killing people by standing near them.

Now the knives land. Twin Fang uses both of them. Backstab is a stab, not a swing - you don't swing a
counter or a knife into someone's back, you put it through the opening. Sap is a blackjack, so it's
blunt with no edge at all. Flurry Cut is a mess of crossing cuts. And the two executes come down like
a decision, because that's what an execute is.

The Paladin's Judgment falls like the hammer it's named after, and the Warden's Stonehand Strike hits
like stone.

Some spells were left plain on purpose. A bleed isn't a shape. Neither is a garrote wire or a dose of
poison. This game knows how to draw eleven kinds of strike and none of them is "poison", so those keep
the plain swing rather than borrowing a silhouette that lies about them.

An admission. I told you last message this would be easy - that the machinery was built and this was
just craft. It wasn't. The field that controls all this was being read in exactly one place in the
entire game, the Fighter's, so writing it onto anybody else would have done precisely nothing. I found
that out by checking before authoring, and then found it again the hard way when I authored the
Rogue's anyway and the test told me all seven were going nowhere.

That's the whole method in one version: don't ask whether the data is there, ask whether anything
reads it.

See docs/V0.20.41_ARMOR_PROFICIENCY.md for the full report.
