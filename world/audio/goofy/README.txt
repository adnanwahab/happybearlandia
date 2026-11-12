GOOFY GAME SFX
==============

20 clearly named snippets from your uploaded video:
15 main clips plus 5 shorter component cuts. Each snippet is available in WAV
and OGG, for 40 audio files in total. The component cuts reuse portions of two
main clips; they are alternate edits, not five additional source effects.

GET STARTED
-----------
1. Extract the whole ZIP.
2. Open index.html in a browser to search, audition, and download clips.
3. Import the wav/ files into your game editor, or use ogg/ for compact delivery.
4. Use manifest.json for stable IDs, filenames, source times, durations, and
   suggested game uses. sound_index.csv is the same catalog in a simple table.

The separate goofy_game_sfx_preview.html download contains all OGG audio and can
be opened by itself. The index inside this ZIP uses the adjacent audio folders.

LABELS AND EDITS
---------------
Labels are descriptive working names based on waveform and spectrogram analysis,
not verified original effect names. Listening-based review was unavailable in
this session. Suggested game uses are creative mappings for your game.

The 15 main clips preserve the full selected phrases, including internal pauses.
Shorter cuts are supplied separately for the triple buzz and two-part phrase.
Small amounts of quiet audio around each effect protect its onset and tail.
The two-part effect has a very quiet precursor that was retained; see its
boundary_note in manifest.json if you want a tighter trigger for that clip.

A 2 ms fade-in and 5 ms fade-out reduce clicks at the cut edges. Each WAV has
sample peaks normalized to -3 dBFS, with gain increases capped at 12 dB. This is
peak normalization, not perceptual loudness matching. No pitch changes, time
stretching, noise reduction, or dynamic compression were applied.

FORMATS
-------
WAV: 44,100 Hz, stereo, signed 16-bit PCM.
OGG: 44,100 Hz, stereo, Vorbis quality 5.

Every exported WAV and OGG was decoded and checked for correct sample count and
absence of new sample clipping. All corresponding WAV/OGG sample counts match.
A WAV export cannot restore quality already lost in the source AAC compression.
These are one-shot clips and phrases; seamless loop points have not been created.

BROWSER GAME EXAMPLE
--------------------
Copy wav/ or ogg/ into your game's public/assets/sfx/ folder. For example,
copy the contents of ogg/ directly into public/assets/sfx/, then:

  const hit = new Audio('/assets/sfx/07_short_low_impact.ogg');
  hit.volume = 0.35;

  // Call from a click/key handler after the player interacts with the page.
  function playHit() {
    hit.currentTime = 0;
    hit.play().catch(console.error);
  }

The example restarts one sound. Use your engine's audio system or preloaded
Web Audio buffers when several copies should overlap. Use the matching WAV
filename if your chosen runtime needs PCM audio.

SOURCE
------
YTDown.com_YouTube_Media_NPbWhDaESds_All-Goofy-Ahh-Sound-Effects_001_1080p.mp4
Duration: 56.54059 seconds

CLIP CATALOG
------------

01. Staccato tone sequence — 2.664 s
    File: 01_staccato_tone_sequence.wav
    Source: 00:00.552–00:03.216
    A sequence of short, distinct pitches with a trailing resonance.
    Suggested game cue: Silly reveal or discovery

02. Wobbling buzzy burst — 1.929 s
    File: 02_wobbling_buzzy_burst.wav
    Source: 00:03.690–00:05.620
    A sustained harmonic burst with rising pitch and several wavering changes.
    Suggested game cue: Startled reaction or strange machine

03. Noisy pitch drop — 1.235 s
    File: 03_noisy_pitch_drop.wav
    Source: 00:06.859–00:08.094
    A brief noisy burst ending in a descending pitch.
    Suggested game cue: Comedic failure or fall

04. Triple rising buzz — 5.926 s
    File: 04_triple_rising_buzz.wav
    Source: 00:08.782–00:14.708
    Three similar rising attacks settling into sustained tones.
    Suggested game cue: Repeated alert or escalating reaction

05. Swelling wavering tone — 3.253 s
    File: 05_swelling_wavering_tone.wav
    Source: 00:15.576–00:18.828
    A quieter lead-in swells into a textured wavering tone and fades.
    Suggested game cue: Build-up to a reveal

06. Rhythmic squeaky rattle — 6.150 s
    File: 06_rhythmic_squeaky_rattle.wav
    Source: 00:19.296–00:25.446
    Repeated bright pulses with changing spacing and a fading ending.
    Suggested game cue: Scrambling or clumsy movement

07. Short low impact — 0.414 s
    File: 07_short_low_impact.wav
    Source: 00:26.054–00:26.469
    A short low-heavy hit with a quick decay.
    Suggested game cue: Small collision or bonk

08. Rattling bass decay — 1.920 s
    File: 08_rattling_bass_decay.wav
    Source: 00:27.674–00:29.594
    A rough low-frequency burst with a longer rumbling tail.
    Suggested game cue: Heavy landing or machinery stop

09. Two-part buzzy phrase — 4.778 s
    File: 09_two_part_buzzy_phrase.wav
    Source: 00:30.280–00:35.058
    A stepped harmonic phrase followed by a separate raspy sustained burst.
    Suggested game cue: Two-stage reaction or gag

10. Rapid rising squeaks — 1.927 s
    File: 10_rapid_rising_squeaks.wav
    Source: 00:36.729–00:38.656
    A rapid series of rising pulses ending at a higher pitch.
    Suggested game cue: Scramble, power-up, or frantic motion

11. Short soft low pop — 0.279 s
    File: 11_short_soft_low_pop.wav
    Source: 00:39.029–00:39.308
    A small isolated low-frequency transient.
    Suggested game cue: Tiny collision or UI pop

12. Pulsing raspy buzz — 2.105 s
    File: 12_pulsing_raspy_buzz.wav
    Source: 00:39.526–00:41.631
    A mid-length buzzy texture with several smaller pulses.
    Suggested game cue: Confused reaction or sputtering object

13. Long rough buzz — 4.338 s
    File: 13_long_rough_buzz.wav
    Source: 00:42.126–00:46.463
    A loud sustained low buzz with noisy overtones.
    Suggested game cue: Comical machine or sustained reaction

14. Long wavering tone phrase — 7.247 s
    File: 14_long_wavering_tone_phrase.wav
    Source: 00:47.080–00:54.327
    A long tonal sequence with a held pitch and several wavering bursts.
    Suggested game cue: Extended character reaction or animated prop

15. Short buzzy blast — 0.694 s
    File: 15_short_buzzy_blast.wav
    Source: 00:55.048–00:55.742
    An abrupt, loud harmonic burst that cuts off quickly.
    Suggested game cue: Quick surprise or comic emphasis

16. Rising buzz — single burst 1 — 1.993 s [shorter cut of sfx_004]
    File: 16_rising_buzz_single_01.wav
    Source: 00:08.782–00:10.775
    Isolated repetition 1 from the triple rising buzz.
    Suggested game cue: Single alert or short character reaction

17. Rising buzz — single burst 2 — 1.999 s [shorter cut of sfx_004]
    File: 17_rising_buzz_single_02.wav
    Source: 00:10.775–00:12.774
    Isolated repetition 2 from the triple rising buzz.
    Suggested game cue: Single alert or short character reaction

18. Rising buzz — single burst 3 — 1.934 s [shorter cut of sfx_004]
    File: 18_rising_buzz_single_03.wav
    Source: 00:12.774–00:14.708
    Isolated repetition 3 from the triple rising buzz.
    Suggested game cue: Single alert or short character reaction

19. Stepped buzzy phrase — 2.761 s [shorter cut of sfx_009]
    File: 19_stepped_buzzy_phrase.wav
    Source: 00:30.280–00:33.041
    First part of the two-part buzzy phrase, with its trailing decay.
    Suggested game cue: Reaction build-up or comic flourish

20. Raspy tone burst — 2.017 s [shorter cut of sfx_009]
    File: 20_raspy_tone_burst.wav
    Source: 00:33.041–00:35.058
    Second part of the two-part buzzy phrase, isolated at the quiet transition.
    Suggested game cue: Separate reaction or short object effect

