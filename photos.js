/*
  "off the clock": the photo deck and its songs.

  PHOTOS is shuffled on every visit and the deck flips through it on its own.
  `alt` is for screen readers only; nothing is captioned on screen.
  Each photo points at a song in SONGS.

  Songs stream as Apple Music's official 30-second previews (`preview`), straight
  from Apple (`apple` is the track page, kept for reference). Nothing is re-hosted here.
  If a preview link ever goes stale, the page looks the track up again by `appleId`,
  and if that fails too it plays a soft chord made in the browser (`chord`, in Hz).

  To use your own clip instead (one you have the rights to), add `track: "/music/file.mp3"`.
*/
window.SONGS = {
  "so-good": {
    title: "So Good", artist: "Jhené Aiko ft. Kendrick Lamar",
    appleId: 6810782057, apple: "https://music.apple.com/us/album/so-good-feat-kendrick-lamar/6810781932",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/4e/ec/4a/4eec4a1d-a773-9aed-144d-edbe11f918f1/mzaf_10323226544810118877.plus.aac.p.m4a",
    chord: [174.61, 220.0, 261.63, 329.63, 392.0],
  },
  "heat-waves": {
    title: "Heat Waves", artist: "Glass Animals",
    appleId: 1508562516, apple: "https://music.apple.com/us/album/heat-waves/1508562310",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a3/4c/b9/a34cb911-40fc-5f0c-e862-14bd171a77aa/mzaf_384792072030970151.plus.aac.p.m4a",
    chord: [110.0, 164.81, 196.0, 246.94, 261.63],
  },
  "less-i-know": {
    title: "The Less I Know the Better", artist: "Tame Impala",
    appleId: 1440838488, apple: "https://music.apple.com/us/album/the-less-i-know-the-better/1440838039",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/5d/2a/2a/5d2a2a7c-a42f-901e-bbf7-d99c33323526/mzaf_5177778173802721769.plus.aac.p.m4a",
    chord: [146.83, 185.0, 220.0, 277.18, 329.63],
  },
  "riptide": {
    title: "Riptide", artist: "Vance Joy",
    appleId: 647013719, apple: "https://music.apple.com/in/album/riptide/647013716",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/2b/06/682b0699-7ad1-55a6-6d8a-d4f9693daec5/mzaf_3533730484724123796.plus.aac.p.m4a",
    chord: [196.0, 246.94, 293.66, 369.99, 440.0],
  },
  "electric-feel": {
    title: "Electric Feel", artist: "MGMT",
    appleId: 264720106, apple: "https://music.apple.com/us/album/electric-feel/264720008",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/47/4a/00/474a0001-c9af-5e52-af16-695889678761/mzaf_2030537019671750043.plus.aac.p.m4a",
    chord: [164.81, 196.0, 246.94, 293.66, 392.0],
  },
  "sunflower": {
    title: "Sunflower", artist: "Post Malone & Swae Lee",
    appleId: 1445949267, apple: "https://music.apple.com/us/album/sunflower-spider-man-into-the-spider-verse/1445949265",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/98/f0/d6/98f0d67e-f8bf-762d-cac7-1c6b3b6b35dd/mzaf_4543283896248560946.plus.aac.p.m4a",
    chord: [146.83, 220.0, 277.18, 329.63, 369.99],
  },
  "see-you-again": {
    title: "See You Again", artist: "Tyler, The Creator ft. Kali Uchis",
    appleId: 1254572572, apple: "https://music.apple.com/us/album/see-you-again-feat-kali-uchis/1254572564",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/31/02/74/31027419-5368-a447-5fbd-d052d9d3cbc4/mzaf_11445750342311530033.plus.aac.p.m4a",
    chord: [155.56, 196.0, 233.08, 293.66, 349.23],
  },
  "sweater-weather": {
    title: "Sweater Weather", artist: "The Neighbourhood",
    appleId: 635016640, apple: "https://music.apple.com/us/album/sweater-weather/635016635",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8c/37/20/8c372047-2727-8054-9411-0e4867643dd8/mzaf_10169659262182214119.plus.aac.p.m4a",
    chord: [130.81, 196.0, 220.0, 293.66, 329.63],
  },
  "top-of-world": {
    title: "On Top of the World", artist: "Imagine Dragons",
    appleId: 1440860498, apple: "https://music.apple.com/in/album/on-top-of-the-world/1440860487",
    preview: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/9e/75/98/9e7598cd-0f6c-b8a9-93cb-17fa48bdd1ab/mzaf_17690821923742552820.plus.aac.p.m4a",
    chord: [116.54, 174.61, 220.0, 293.66, 349.23],
  },
};

window.PHOTOS = [
  { img: "/photos/00.jpg", alt: "sunset over a rocky shore", song: "heat-waves" },
  { img: "/photos/01.jpg", alt: "silhouette against the sunset by the sea", song: "so-good" },
  { img: "/photos/02.jpg", alt: "cliffside view of the coast", song: "riptide" },
  { img: "/photos/03.jpg", alt: "rocky beach on a clear day", song: "sunflower" },
  { img: "/photos/04.jpg", alt: "standing by the sea in a blue cap", song: "riptide" },
  { img: "/photos/05.jpg", alt: "rocks and open sea", song: "less-i-know" },
  { img: "/photos/06.jpg", alt: "selfie by the water with the sun behind", song: "sunflower" },
  { img: "/photos/07.jpg", alt: "selfie at a beach stay", song: "see-you-again" },
  { img: "/photos/08.jpg", alt: "sitting at a beach stay", song: "see-you-again" },
  { img: "/photos/09.jpg", alt: "on a boat in a life jacket", song: "electric-feel" },
  { img: "/photos/10.jpg", alt: "portrait at sunset on the beach", song: "heat-waves" },
  { img: "/photos/11.jpg", alt: "another sunset portrait on the beach", song: "less-i-know" },
  { img: "/photos/12.jpg", alt: "sunset reflecting on wet sand", song: "so-good" },
  { img: "/photos/13.jpg", alt: "parasailing over the sea", song: "electric-feel" },
  { img: "/photos/14.jpg", alt: "the sea from a cliff, palm leaves in frame", song: "riptide" },
  { img: "/photos/15.jpg", alt: "smiling in the snow", song: "sweater-weather" },
  { img: "/photos/16.jpg", alt: "in a yellow kurta", song: "see-you-again" },
  { img: "/photos/17.jpg", alt: "skiing in a red snowsuit", song: "top-of-world" },
  { img: "/photos/18.jpg", alt: "looking out at snowy peaks", song: "sweater-weather" },
];
