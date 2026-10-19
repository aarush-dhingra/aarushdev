# aarush.dhingra

Personal site. Plain HTML/CSS/JS with no build step.

```
index.html            home
projects/index.html   projects (live demos, hackathons)
css/style.css         everything visual, light + dark
js/core.js            shared: intro, sunset scene, topo background, theme, nav, dock, spotlight cards
js/home.js            flip words, stealth card, github + leetcode, photo deck + music, pitch box
js/projects.js        the project demos
photos.js             the "off the clock" prints + songs (edit this)
assets/               favicon, resume pdf
photos/  music/       your images and songs
```

## Run locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173. It needs a server: paths are absolute, so opening the file directly won't work.

The sunset intro plays on every load of the home page. Click, scroll or press a key to skip it.

## Photos + songs

`photos.js` has two lists. `PHOTOS` is the deck of prints, shuffled on every visit; it flips to the next print every few seconds, and visitors can drag the top one away or use the arrows. `SONGS` holds the tracks, and each photo points at one by its key.

Songs play Apple Music's official 30-second previews, streamed straight from Apple, so no copyrighted audio is hosted here. Each entry in `SONGS` has an `appleId`, the `preview` link and the `apple` page (kept in the data, not shown on the page).

To change a song, find it with the iTunes Search API (`https://itunes.apple.com/search?term=artist+song&entity=song`) and copy its `trackId`, `previewUrl` and `trackViewUrl` into `SONGS`. To change which song a photo plays, change that photo's `song` key. If a preview ever fails, the page looks the track up again by `appleId`, then falls back to a soft generated chord.

To play your own clip instead (one you have the rights to), add `track: "/music/file.mp3"` to that song.

To add a photo, put it in `photos/` (portrait, about 640×800) and add a line to `PHOTOS`.

## Update the resume

Replace `assets/aarush-dhingra-resume.pdf` and keep the same name.

## Deploy

Push to GitHub and import the repo on Vercel. Framework preset: **Other**, with no build command and no output directory. `/projects/` resolves to `projects/index.html` automatically.
