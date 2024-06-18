HNhance, a userscript for HN

Script installation: https://raw.githubusercontent.com/megagrump/hnhance/master/hnhance.user.js
Code repo: https://github.com/megagrump/hnhance

I made this for personal use because I wanted dark mode and content filtering on Hacker News. I reckon others may find it useful as well.

- Dark mode toggle
- Comment auto-collapse (filter by user)
- Submission filtering (filter by user and domain)
- YC ads removal (hide unvotable submissions)

Use the hamburger menu on the right side of the header bar to configure the script. It shows options based on the current context; to block a user, go to their profile page.

Dark mode uses quick and dirty CSS filters. This approach works well for normal text, but falls short when dealing with images. Fortunately, HN doesn't typically display many images, and users tend not to use emojis either. While a cleaner implementation is possible, I don't see a strong motivation to do so.
