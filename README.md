# Movie Dairy

A simple web app to help you pick what to watch. Search or browse movies, filter by genre/year, check ratings, and see where a movie is available to stream, rent, or buy. You can also compare up to 3 movies side by side.

This was built for the "Playing Around with APIs" Web Infrastructure Summative. It runs on plain HTML, CSS, and JavaScript, no frameworks or build tools.

## Live links


## Features

- Search movies by title
- Filter by genre and release year
- Sort by popularity, rating, or newest
- Pagination through results
- Movie details: overview, genres, runtime, rating
- Where to watch: streaming, rent, and buy options pulled from TMDB
- Compare up to 3 movies at once
- Light and dark mode toggle (saved so it stays on your next visit)
- Shows which server (web01 or web02) answered the request, using the load balancer's X-Served-By header

## Credits
 
All movie data, images, and watch-provider info come from [The Movie Database (TMDB)](https://www.themoviedb.org/documentation/api). This product uses the TMDB API but is not endorsed or certified by TMDB. No other API is used.
 
Google Fonts (Plus Jakarta Sans, Inter) are loaded from Google's CDN.

## Challenges
 
- Started with a medication checker using openFDA, but the text matching kept producing results that looked scarier than they should. Dropped it before building too much on top of a shaky foundation.
- Tried a healthcare facility finder for Rwanda next, using a government GIS API. The data was real but one test query took about 5 minutes to return 10 records, way too slow to call live from an app. Dropped that too rather than build around a broken assumption.
- Landed on TMDB after testing it responded fast and reliably. Tried adding JustWatch as a second API for streaming info, but its search endpoint kept returning the wrong movie no matter what was typed in. Turned out TMDB already had its own watch-provider endpoint, so JustWatch got dropped entirely and the whole app runs on one API instead of two.
- I must say getting the watch-provider data to display sensibly was trickier than I expected, since availability differs by country and some movies (especially brand new releases) have no data yet. Had to add a fallback so the app doesn't just show a blank section when that happens.


## Error handling

- Missing or invalid API key shows a clear message instead of a blank page
- Rate limits and slow/failed requests are caught and shown to the user
- No results (search or filters) shows a message instead of an empty grid
- Missing posters show a placeholder instead of a broken image
- Movies with no watch-provider data (new releases) show a message explaining that
- Offline detection: a banner shows up if your connection drops, and clears when it's back
- A custom 404 page for any URL that doesn't exist

## Running it locally

1. Clone this repo `git clone https://github.com/s-chukwu/movie_diary`
2. Copy `config.example.js` to `config.js`
3. Get a free API key at https://www.themoviedb.org/settings/api and paste it into `config.js`
4. Open `index.html` in your browser

No build step, no npm install, nothing else needed.

## Files

- `index.html` — page structure
- `styles.css` — all styling
- `app.js` — all the logic (fetching data, search, filters, compare, etc.)
- `config.js` — holds the API key (not committed to git)
- `config.example.js` — template so others know what config.js should look like
- `404.html` — custom not-found page
- `.gitignore` — keeps config.js out of the repo

## Deployment

Deployed on two servers (web01, web02) behind a load balancer. Files are copied over with scp, then moved into `/var/www/html/` on each server. The X-Served-By header confirms which server answered a request, which is how the load balancing is verified.
